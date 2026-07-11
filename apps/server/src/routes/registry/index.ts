import { zValidator } from '@hono/zod-validator';

import { createRouter } from '../../lib/create-app.js';
import * as githubRoutes from './registry-github.routes.js';
import * as npmRoutes from './registry-npm.routes.js';
import * as pinRoutes from './registry-pins.routes.js';
import * as repoPinRoutes from './registry-repo-pins.routes.js';
import { pinBodySchema, repoPinBodySchema, searchQuerySchema } from './registry.schema.js';

export const registryRouter = createRouter()
  .get(npmRoutes.npmSearch.path, zValidator('query', searchQuerySchema), npmRoutes.npmSearch.handler)
  .get(npmRoutes.npmPackage.path, npmRoutes.npmPackage.handler)
  .get(pinRoutes.listPins.path, pinRoutes.listPins.handler)
  .post(pinRoutes.pinPackage.path, zValidator('json', pinBodySchema), pinRoutes.pinPackage.handler)
  .delete(pinRoutes.unpinPackage.path, pinRoutes.unpinPackage.handler)
  .get(
    githubRoutes.githubSearch.path,
    zValidator('query', searchQuerySchema),
    githubRoutes.githubSearch.handler,
  )
  .get(githubRoutes.githubRepo.path, githubRoutes.githubRepo.handler)
  .get(repoPinRoutes.listRepoPins.path, repoPinRoutes.listRepoPins.handler)
  .post(
    repoPinRoutes.pinRepository.path,
    zValidator('json', repoPinBodySchema),
    repoPinRoutes.pinRepository.handler,
  )
  .delete(repoPinRoutes.unpinRepository.path, repoPinRoutes.unpinRepository.handler);
