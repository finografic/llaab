import { zValidator } from '@hono/zod-validator';

import { createRouter } from '../../lib/create-app.js';
import * as routes from './agent.routes.js';
import { runAgentBodySchema } from './agent.schema.js';

export const agentRouter = createRouter()
  .post(routes.run.path, zValidator('json', runAgentBodySchema), routes.run.handler)
  .get(routes.status.path, routes.status.handler);
