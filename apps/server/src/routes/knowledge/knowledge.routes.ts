import {
  buildKnowledgeWikiGraph,
  exportKnowledgeWikiGraph,
  listKnowledgeWikis as readKnowledgeWikis,
  readKnowledgeWiki,
} from '@llaab/core';
import type { AppCtx } from '../../types/app.types.js';

import { listKnowledgeWikisQuerySchema } from './knowledge.schema.js';

export const listKnowledgeWikis = {
  path: '/wikis' as const,
  handler: async (c: AppCtx) => {
    const query = listKnowledgeWikisQuerySchema.parse(Object.fromEntries(new URL(c.req.url).searchParams));
    const wikis = (await readKnowledgeWikis())
      .filter((wiki) => (query.lifecycle ? wiki.status === query.lifecycle : true))
      .filter((wiki) => (query.tag ? wiki.tags.includes(query.tag) : true))
      .filter((wiki) => (query.verification ? wiki.verification_status === query.verification : true))
      .filter((wiki) => {
        if (!query.q) return true;
        const haystack =
          `${wiki.title} ${wiki.summary} ${wiki.topic_key} ${wiki.aliases.join(' ')}`.toLowerCase();
        return haystack.includes(query.q.toLowerCase());
      });
    return c.json({ wikis: wikis.slice(query.offset, query.offset + query.limit), total: wikis.length });
  },
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

export const knowledgeWikiGraph = {
  path: '/wikis/graph' as const,
  handler: async (c: AppCtx) => {
    const query = listKnowledgeWikisQuerySchema.parse(Object.fromEntries(new URL(c.req.url).searchParams));
    return c.json({ graph: await buildKnowledgeWikiGraph(query) });
  },
};

export const exportKnowledgeWikiGraphRoute = {
  path: '/wikis/graph/export' as const,
  handler: async (c: AppCtx) => {
    const query = listKnowledgeWikisQuerySchema.parse(Object.fromEntries(new URL(c.req.url).searchParams));
    return c.json(await exportKnowledgeWikiGraph(query), 201);
  },
};
