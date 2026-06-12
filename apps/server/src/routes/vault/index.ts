import { zValidator } from '@hono/zod-validator';

import { createRouter } from '../../lib/create-app.js';
import { requireVaultSession } from '../../middlewares/vault-auth.middleware.js';
import * as routes from './vault.routes.js';
import {
  cleanRecentBodySchema,
  createNodeBodySchema,
  deleteRunQuerySchema,
  listNodesQuerySchema,
  updateSourceProfilesBodySchema,
  vaultLoginBodySchema,
} from './vault.schema.js';

export const vaultRouter = createRouter()
  .post(routes.vaultAuthLogin.path, zValidator('json', vaultLoginBodySchema), routes.vaultAuthLogin.handler)
  .get(routes.vaultAuthLogout.path, routes.vaultAuthLogout.handler)
  .get(routes.vaultAuthSession.path, routes.vaultAuthSession.handler)
  .use(requireVaultSession)
  .get(routes.vaultTree.path, routes.vaultTree.handler)
  .post(routes.cleanRecent.path, zValidator('json', cleanRecentBodySchema), routes.cleanRecent.handler)
  .get(routes.file.path, routes.file.handler)
  .get(routes.listVaultNodes.path, zValidator('query', listNodesQuerySchema), routes.listVaultNodes.handler)
  .post(routes.createVaultNode.path, zValidator('json', createNodeBodySchema), routes.createVaultNode.handler)
  .get(routes.nodeDetail.path, routes.nodeDetail.handler)
  .post(routes.enrichSource.path, routes.enrichSource.handler)
  .patch(
    routes.updateSourceProfiles.path,
    zValidator('json', updateSourceProfilesBodySchema),
    routes.updateSourceProfiles.handler,
  )
  .get(routes.nodeRaw.path, routes.nodeRaw.handler)
  .get(routes.transcriptIdeas.path, routes.transcriptIdeas.handler)
  .post(routes.extractTranscript.path, routes.extractTranscript.handler)
  .delete(routes.discardTranscript.path, routes.discardTranscript.handler)
  .delete(routes.deleteRun.path, zValidator('query', deleteRunQuerySchema), routes.deleteRun.handler);
