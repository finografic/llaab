import { createRouter } from '../../lib/create-app.js';
import * as routes from './knowledge.routes.js';

export const knowledgeRouter = createRouter()
  .get(routes.listKnowledgeWikis.path, routes.listKnowledgeWikis.handler)
  .get(routes.knowledgeWikiGraph.path, routes.knowledgeWikiGraph.handler)
  .get(routes.knowledgeWikiDetail.path, routes.knowledgeWikiDetail.handler);
