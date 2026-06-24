import { zValidator } from '@hono/zod-validator';

import { createRouter } from '../../lib/create-app.js';
import * as routes from './crons.routes.js';
import { createCronRecipeBodySchema, updateCronRecipeBodySchema } from './crons.schema.js';

export const cronsRouter = createRouter()
  .get(routes.list.path, routes.list.handler)
  .post(routes.create.path, zValidator('json', createCronRecipeBodySchema), routes.create.handler)
  .post(routes.run.path, routes.run.handler)
  .patch(routes.update.path, zValidator('json', updateCronRecipeBodySchema), routes.update.handler);
