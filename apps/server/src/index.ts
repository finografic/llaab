import { pc } from './utils/picocolors.js';

import { app } from './app.js';

const port = Number(process.env['PORT'] ?? 3000);
const LONG_RUNNING_PATHS = [/^\/api\/ingest\/youtube$/, /^\/api\/vault\/transcripts\/[^/]+\/extract$/];

console.log(pc.bold(`@llaab/server`) + pc.gray(` starting on port ${port}…`));

export default {
  port,
  idleTimeout: 10,
  fetch(req: Request, server: Bun.Server<undefined>) {
    const pathname = new URL(req.url).pathname;

    // These routes can spend tens of seconds waiting on yt-dlp or the model.
    // Disable Bun's default 10s idle timeout so the client sees the real result.
    if (LONG_RUNNING_PATHS.some((pattern) => pattern.test(pathname))) {
      server.timeout(req, 0);
    }

    return app.fetch(req);
  },
};
