import { createRouter } from '../lib/create-app.js';

const router = createRouter();

router.get('/', (c) => {
  return c.json({
    name: '@llaab/server',
    version: '0.0.1',
    status: 'ok',
  });
});

export { router as indexRouter };
