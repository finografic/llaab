import { createRouter } from '../lib/create-app.js';

export const indexRouter = createRouter().get('/', (c) =>
  c.json({ name: '@llaab/server', version: '0.0.1', status: 'ok' }),
);
