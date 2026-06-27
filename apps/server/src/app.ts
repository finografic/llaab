import { cors } from 'hono/cors';

import { createApp } from './lib/create-app.js';

import { requireAuth, sessionMiddleware } from './middlewares/auth.middleware.js';
import { logger } from './middlewares/logger.middleware.js';
import { agentRouter } from './routes/agent/index.js';
import { authRouter } from './routes/auth/index.js';
import { cronsRouter } from './routes/crons/index.js';
import { indexRouter } from './routes/index.route.js';
import { ingestRouter } from './routes/ingest/index.js';
import { llmRouter } from './routes/llm/index.js';
import { registryRouter } from './routes/registry/index.js';
import { runsRouter } from './routes/runs/index.js';
import { uiStateRouter } from './routes/ui-state/index.js';
import { vaultRouter } from './routes/vault/index.js';

// ── Base app with global middleware ───────────────────────────────────────────

const _base = createApp();

_base.use(
  cors({
    origin: ['http://localhost:3000', 'http://llaab.localhost:3000'],
    allowHeaders: ['Content-Type', 'X-API-Key'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  }),
);

_base.use(logger);
_base.use('/api/*', sessionMiddleware);
_base.use('/api/*', requireAuth);

_base.notFound((c) => c.json({ error: 'Not found' }, 404));
_base.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message ?? 'Internal server error' }, 500);
});

// ── Routes — chained so AppType captures the full route shape ─────────────────

export const app = _base
  .route('/', indexRouter)
  .route('/api/agent', agentRouter)
  .route('/api/auth', authRouter)
  .route('/api/crons', cronsRouter)
  .route('/api/ingest', ingestRouter)
  .route('/api/llm', llmRouter)
  .route('/api/vault', vaultRouter)
  .route('/api/registry', registryRouter)
  .route('/api/runs', runsRouter)
  .route('/api/ui-state', uiStateRouter);

/** Exported for Hono RPC — import as `import type { AppType } from '@llaab/server'` */
export type AppType = typeof app;
