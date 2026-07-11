import { reconcileOrphanedActiveRuns } from '@llaab/skills';

import { pc } from './utils/picocolors.js';

import { app } from './app.js';
import { dispatchCommandEnvelope } from './commands/index.js';

const port = Number(process.env['PORT'] ?? 8888);
const COMMAND_TIMEOUT_MS = 120_000;
const LONG_RUNNING_PATHS = [
  /^\/api\/ingest\/youtube$/,
  /^\/api\/crons\/[^/]+\/run$/,
  /^\/api\/vault\/sources\/[^/]+\/enrich$/,
  /^\/api\/vault\/transcripts\/[^/]+\/extract$/,
  /^\/api\/vault\/transcripts\/[^/]+\/consolidate$/,
  /^\/api\/registry\/github\/repo\/[^/]+\/[^/]+$/,
  /^\/api\/registry\/github\/repo\/[^/]+\/[^/]+\/npm$/,
  /^\/api\/registry\/npm\/package\/[^/]+\/stats$/,
  /^\/terminal$/,
];

console.log(pc.bold(`@llaab/server`) + pc.gray(` starting on port ${port}…`));

// Any pending/running RunNode on disk after boot is orphaned — handlers live only in-process.
void reconcileOrphanedActiveRuns().then((count) => {
  if (count > 0) {
    console.log(pc.yellow(`Failed ${count} orphaned active run${count === 1 ? '' : 's'} after restart.`));
  }
});

export default {
  port,
  idleTimeout: 10,
  fetch(req: Request, server: Bun.Server<undefined>) {
    const pathname = new URL(req.url).pathname;

    // These routes can spend tens of seconds waiting on yt-dlp, YouTube OAuth, or the model.
    // Disable Bun's default 10s idle timeout so the client sees the real result.
    if (LONG_RUNNING_PATHS.some((pattern) => pattern.test(pathname))) {
      server.timeout(req, 0);
    }

    if (pathname === '/terminal') {
      const upgraded = server.upgrade(req);
      if (!upgraded) return new Response('WebSocket upgrade failed', { status: 400 });
      return undefined;
    }

    return app.fetch(req);
  },
  websocket: {
    async message(ws: Bun.ServerWebSocket<undefined>, message: string | Buffer) {
      const payload = typeof message === 'string' ? message : message.toString('utf-8');
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        ws.send(
          JSON.stringify({
            id: 'timeout',
            timestamp: new Date().toISOString(),
            event: {
              type: 'error',
              code: 'COMMAND_TIMEOUT',
              message: `Command exceeded ${COMMAND_TIMEOUT_MS}ms timeout.`,
            },
          }),
        );
        ws.send(
          JSON.stringify({
            id: 'timeout',
            timestamp: new Date().toISOString(),
            event: { type: 'done', code: 1 },
          }),
        );
      }, COMMAND_TIMEOUT_MS);

      try {
        const input = JSON.parse(payload) as unknown;
        for await (const envelope of dispatchCommandEnvelope(input)) {
          if (timedOut) break;
          ws.send(JSON.stringify(envelope));
        }
      } catch (error) {
        ws.send(
          JSON.stringify({
            id: 'terminal',
            timestamp: new Date().toISOString(),
            event: {
              type: 'error',
              code: 'TERMINAL_MESSAGE_FAILED',
              message: error instanceof Error ? error.message : String(error),
            },
          }),
        );
        ws.send(
          JSON.stringify({
            id: 'terminal',
            timestamp: new Date().toISOString(),
            event: { type: 'done', code: 1 },
          }),
        );
      } finally {
        clearTimeout(timeout);
      }
    },
  },
};
