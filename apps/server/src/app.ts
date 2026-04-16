import { cors } from 'hono/cors';

import { createApp } from './lib/create-app.js';

import { auth } from './middlewares/auth.middleware.js';
import { logger } from './middlewares/logger.middleware.js';
import { agentRouter } from './routes/agent/index.js';
import { indexRouter } from './routes/index.route.js';
import { ingestRouter } from './routes/ingest/index.js';
import { llmRouter } from './routes/llm/index.js';
import { runsRouter } from './routes/runs/index.js';
import { vaultRouter } from './routes/vault/index.js';

const app = createApp();

// ── Global middleware ─────────────────────────────────────────────────────────

app.use(
  cors({
    origin: [
      'http://localhost:4321', // Astro client dev
      'http://localhost:3000',
    ],
    allowHeaders: ['Content-Type', 'X-API-Key'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);

app.use(logger);

// ── Routes ────────────────────────────────────────────────────────────────────

app.route('/', indexRouter);
app.use('/api/*', auth);
app.route('/api/agent', agentRouter);
app.route('/api/ingest', ingestRouter);
app.route('/api/llm', llmRouter);
app.route('/api/vault', vaultRouter);
app.route('/api/runs', runsRouter);

// ── 404 fallback ──────────────────────────────────────────────────────────────

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message ?? 'Internal server error' }, 500);
});

export { app };
