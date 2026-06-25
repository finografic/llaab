import { zValidator } from '@hono/zod-validator';

import { createRouter } from '../../lib/create-app.js';
import * as routes from './auth.routes.js';
import { authLoginBodySchema } from './auth.schema.js';

export const authRouter = createRouter()
  .post(routes.login.path, zValidator('json', authLoginBodySchema), routes.login.handler)
  .post(routes.logout.path, routes.logout.handler)
  .get(routes.session.path, routes.session.handler);
