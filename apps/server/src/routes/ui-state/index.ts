import { zValidator } from '@hono/zod-validator';

import { createRouter } from '../../lib/create-app.js';
import * as routes from './ui-state.routes.js';
import { setUiStateBodySchema } from './ui-state.schema.js';

export const uiStateRouter = createRouter()
  .get(routes.get.path, routes.get.handler)
  .put(routes.set.path, zValidator('json', setUiStateBodySchema), routes.set.handler);
