import { zValidator } from '@hono/zod-validator';

import { createRouter } from '../../lib/create-app.js';
import * as routes from './llm.routes.js';
import { completeLlmBodySchema } from './llm.schema.js';

export const llmRouter = createRouter()
  .post(routes.complete.path, zValidator('json', completeLlmBodySchema), routes.complete.handler)
  .post(routes.stream.path, zValidator('json', completeLlmBodySchema), routes.stream.handler)
  .get(routes.models.path, routes.models.handler)
  .get(routes.status.path, routes.status.handler)
  .get(routes.capabilities.path, routes.capabilities.handler);
