import {
  buildKnowledgeWikiGraph,
  exportKnowledgeWikiGraph,
  listKnowledgeWikis as readKnowledgeWikis,
  readKnowledgeWiki,
} from '@llaab/core';
import type { AppCtx } from '../../types/app.types.js';

import { renderWikiBodyToHtml, renderWikiSectionsToHtml } from '../../lib/wiki-body-renderer.js';
import {
  deleteKnowledgeWikiSection,
  regenerateKnowledgeWikiSection,
} from './knowledge-wiki-review.service.js';
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
      const wiki = await readKnowledgeWiki(c.req.param('id') ?? '');
      const [bodyHtml, sections] = await Promise.all([
        renderWikiBodyToHtml(wiki.body, wiki.source_refs),
        renderWikiSectionsToHtml(wiki.body, wiki.source_refs),
      ]);
      return c.json({ wiki, bodyHtml, sections });
    } catch {
      return c.json({ error: 'Knowledge wiki not found.' }, 404);
    }
  },
};

export const regenerateWikiSection = {
  path: '/wikis/:id/sections/:sectionId/regenerate' as const,
  handler: async (c: AppCtx) => {
    try {
      return c.json({
        success: true,
        ...(await regenerateKnowledgeWikiSection(c.req.param('id') ?? '', c.req.param('sectionId') ?? '')),
      });
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : 'Wiki section regeneration failed.' },
        400,
      );
    }
  },
};

export const deleteWikiSection = {
  path: '/wikis/:id/sections/:sectionId' as const,
  handler: async (c: AppCtx) => {
    try {
      return c.json({
        success: true,
        wiki: await deleteKnowledgeWikiSection(c.req.param('id') ?? '', c.req.param('sectionId') ?? ''),
      });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Wiki section deletion failed.' }, 400);
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
