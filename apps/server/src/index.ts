import { pc } from './utils/picocolors.js';

import { app } from './app.js';

const port = Number(process.env['PORT'] ?? 3000);

console.log(pc.bold(`@llaab/server`) + pc.gray(` starting on port ${port}…`));

export default {
  port,
  fetch: app.fetch,
};
