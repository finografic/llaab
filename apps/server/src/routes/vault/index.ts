import { zValidator } from '@hono/zod-validator';

import { createRouter } from '../../lib/create-app.js';
import * as routes from './vault.routes.js';
import { createNodeBodySchema, listNodesQuerySchema } from './vault.schema.js';

export const vaultRouter = createRouter()
  .get(routes.file.path, routes.file.handler)
  .get(routes.listVaultNodes.path, zValidator('query', listNodesQuerySchema), routes.listVaultNodes.handler)
  .post(routes.createVaultNode.path, zValidator('json', createNodeBodySchema), routes.createVaultNode.handler)
  .get(routes.nodeDetail.path, routes.nodeDetail.handler)
  .get(routes.nodeRaw.path, routes.nodeRaw.handler)
  .get(routes.transcriptIdeas.path, routes.transcriptIdeas.handler)
  .post(routes.extractTranscript.path, routes.extractTranscript.handler)
  .delete(routes.discardTranscript.path, routes.discardTranscript.handler);
