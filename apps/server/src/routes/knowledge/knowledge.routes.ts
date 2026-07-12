import { listKnowledgeWikis as readKnowledgeWikis, readKnowledgeWiki } from '@llaab/core';
import type { AppCtx } from '../../types/app.types.js';

export const listKnowledgeWikis = {
  path: '/wikis' as const,
  handler: async (c: AppCtx) => c.json({ wikis: await readKnowledgeWikis() }),
};

export const knowledgeWikiDetail = {
  path: '/wikis/:id' as const,
  handler: async (c: AppCtx) => {
    try {
      return c.json({ wiki: await readKnowledgeWiki(c.req.param('id') ?? '') });
    } catch {
      return c.json({ error: 'Knowledge wiki not found.' }, 404);
    }
  },
};
