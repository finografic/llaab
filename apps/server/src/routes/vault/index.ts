import { zValidator } from '@hono/zod-validator';

import { createRouter } from '../../lib/create-app.js';
import { requireVaultSession } from '../../middlewares/vault-auth.middleware.js';
import * as routes from './vault.routes.js';
import {
  cleanRecentBodySchema,
  createWikiDraftBodySchema,
  batchUpdateVaultNodesBodySchema,
  codeHighlightBodySchema,
  createNodeBodySchema,
  createResourceNodeBodySchema,
  deleteRunQuerySchema,
  deleteRunsPreviewBodySchema,
  listNodesQuerySchema,
  mediaQuerySchema,
  promoteCanonicalIdeaBodySchema,
  resolveCanonicalIdeaConflictBodySchema,
  updateSourceProfilesBodySchema,
  updateVaultNodeBodySchema,
  vaultLoginBodySchema,
} from './vault.schema.js';

export const vaultRouter = createRouter()
  .post(routes.vaultAuthLogin.path, zValidator('json', vaultLoginBodySchema), routes.vaultAuthLogin.handler)
  .get(routes.vaultAuthLogout.path, routes.vaultAuthLogout.handler)
  .get(routes.vaultAuthSession.path, routes.vaultAuthSession.handler)
  .use(requireVaultSession)
  .get(routes.vaultTree.path, routes.vaultTree.handler)
  .post(routes.cleanRecent.path, zValidator('json', cleanRecentBodySchema), routes.cleanRecent.handler)
  .post(routes.codeHighlight.path, zValidator('json', codeHighlightBodySchema), routes.codeHighlight.handler)
  .get(routes.media.path, zValidator('query', mediaQuerySchema), routes.media.handler)
  .get(routes.file.path, routes.file.handler)
  .get(routes.listVaultNodes.path, zValidator('query', listNodesQuerySchema), routes.listVaultNodes.handler)
  .post(routes.createVaultNode.path, zValidator('json', createNodeBodySchema), routes.createVaultNode.handler)
  .post(
    routes.createVaultResourceNode.path,
    zValidator('json', createResourceNodeBodySchema),
    routes.createVaultResourceNode.handler,
  )
  .post(
    routes.batchUpdateVaultNodes.path,
    zValidator('json', batchUpdateVaultNodesBodySchema),
    routes.batchUpdateVaultNodes.handler,
  )
  .get(routes.nodeDetail.path, routes.nodeDetail.handler)
  .patch(
    routes.updateVaultNode.path,
    zValidator('json', updateVaultNodeBodySchema),
    routes.updateVaultNode.handler,
  )
  .delete(routes.deleteVaultNode.path, routes.deleteVaultNode.handler)
  .post(routes.enrichSource.path, routes.enrichSource.handler)
  .patch(
    routes.updateSourceProfiles.path,
    zValidator('json', updateSourceProfilesBodySchema),
    routes.updateSourceProfiles.handler,
  )
  .get(routes.nodeRaw.path, routes.nodeRaw.handler)
  .get(routes.vaultGitStatus.path, routes.vaultGitStatus.handler)
  .get(routes.vaultGitDiff.path, routes.vaultGitDiff.handler)
  .post(routes.vaultGitCommit.path, routes.vaultGitCommit.handler)
  .post(routes.vaultGitReset.path, routes.vaultGitReset.handler)
  .get(routes.transcriptIdeas.path, routes.transcriptIdeas.handler)
  .post(routes.extractTranscript.path, routes.extractTranscript.handler)
  .post(routes.consolidateTranscriptIdeas.path, routes.consolidateTranscriptIdeas.handler)
  .post(
    routes.createWikiDraft.path,
    zValidator('json', createWikiDraftBodySchema),
    routes.createWikiDraft.handler,
  )
  .get(routes.listWikiDrafts.path, routes.listWikiDrafts.handler)
  .get(routes.wikiDraftDetail.path, routes.wikiDraftDetail.handler)
  .post(routes.promoteWikiDraft.path, routes.promoteWikiDraft.handler)
  .post(routes.rejectWikiDraft.path, routes.rejectWikiDraft.handler)
  .post(
    routes.resolveCanonicalIdeaConflict.path,
    zValidator('json', resolveCanonicalIdeaConflictBodySchema),
    routes.resolveCanonicalIdeaConflict.handler,
  )
  .post(routes.cleanCanonicalIdeaArtifacts.path, routes.cleanCanonicalIdeaArtifacts.handler)
  .post(
    routes.promoteCanonicalIdea.path,
    zValidator('json', promoteCanonicalIdeaBodySchema),
    routes.promoteCanonicalIdea.handler,
  )
  .delete(routes.discardTranscript.path, routes.discardTranscript.handler)
  .delete(routes.deleteRun.path, zValidator('query', deleteRunQuerySchema), routes.deleteRun.handler)
  .post(
    routes.previewDeleteRuns.path,
    zValidator('json', deleteRunsPreviewBodySchema),
    routes.previewDeleteRuns.handler,
  );
