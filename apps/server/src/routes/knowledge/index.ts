import { createRouter } from '../../lib/create-app.js';
import * as routes from './knowledge.routes.js';

export const knowledgeRouter = createRouter()
  .get(routes.listKnowledgeWikis.path, routes.listKnowledgeWikis.handler)
  .get(routes.knowledgeWikiGraph.path, routes.knowledgeWikiGraph.handler)
  .post(routes.exportKnowledgeWikiGraphRoute.path, routes.exportKnowledgeWikiGraphRoute.handler)
  .get(routes.knowledgeWikiDetail.path, routes.knowledgeWikiDetail.handler)
  .post(routes.demoteKnowledgeWikiRoute.path, routes.demoteKnowledgeWikiRoute.handler)
  .delete(routes.deleteKnowledgeWikiRoute.path, routes.deleteKnowledgeWikiRoute.handler)
  .post(routes.regenerateWikiSection.path, routes.regenerateWikiSection.handler)
  .delete(routes.deleteWikiSection.path, routes.deleteWikiSection.handler);
