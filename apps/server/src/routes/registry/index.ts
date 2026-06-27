import { zValidator } from '@hono/zod-validator';

import { createRouter } from '../../lib/create-app.js';
import * as npmRoutes from './registry-npm.routes.js';
import * as pinRoutes from './registry-pins.routes.js';
import { pinBodySchema, searchQuerySchema } from './registry.schema.js';

export const registryRouter = createRouter()
  .get(npmRoutes.npmSearch.path, zValidator('query', searchQuerySchema), npmRoutes.npmSearch.handler)
  .get(npmRoutes.npmPackage.path, npmRoutes.npmPackage.handler)
  .get(pinRoutes.listPins.path, pinRoutes.listPins.handler)
  .post(pinRoutes.pinLibrary.path, zValidator('json', pinBodySchema), pinRoutes.pinLibrary.handler)
  .delete(pinRoutes.unpinLibrary.path, pinRoutes.unpinLibrary.handler);
