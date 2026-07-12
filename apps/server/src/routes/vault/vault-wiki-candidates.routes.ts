import { listNodes, readNodeByType } from '@llaab/core';
import { compileWikiDraft, discoverWikiCandidates as runWikiDiscovery, researchWiki } from '@llaab/skills';
import type { AppCtx, AppCtxJson } from '../../types/app.types.js';
import type { WikiResearchRequest } from '@llaab/schemas';

export const discoverWikiCandidates = {
  path: '/wiki-candidates/discover' as const,
  handler: async (c: AppCtx) => {
    const { record, result } = await runWikiDiscovery();
    if (record.status === 'failed') return c.json({ error: record.error ?? 'Wiki discovery failed.' }, 500);
    return c.json({ success: true, runId: record.runNodeId, ...result }, 201);
  },
};

export const listWikiCandidates = {
  path: '/wiki-candidates' as const,
  handler: async (c: AppCtx) => c.json({ candidates: await listNodes({ type: 'wiki-candidate' }) }),
};

export const wikiCandidateDetail = {
  path: '/wiki-candidates/:id' as const,
  handler: async (c: AppCtx) => {
    try {
      return c.json({ candidate: await readNodeByType('wiki-candidate', c.req.param('id') ?? '') });
    } catch {
      return c.json({ error: 'Wiki candidate not found.' }, 404);
    }
  },
};

export const compileWikiCandidate = {
  path: '/wiki-candidates/:id/compile' as const,
  handler: async (c: AppCtx) => {
    try {
      const candidate = await readNodeByType('wiki-candidate', c.req.param('id') ?? '');
      const transcriptId = candidate.source_transcript_ids[0];
      if (!transcriptId) return c.json({ error: 'Wiki candidate has no transcript evidence.' }, 409);
      const { record, result } = await compileWikiDraft({
        transcriptId,
        canonicalIdeaIds: candidate.source_canonical_idea_ids,
        suggestedTitle: candidate.title,
        entryPath: 'automatic',
      });
      if (record.status === 'failed')
        {return c.json({ error: record.error ?? 'Wiki compilation failed.' }, 500);}
      return c.json({ success: true, runId: record.runNodeId, ...result }, 201);
    } catch {
      return c.json({ error: 'Wiki candidate not found.' }, 404);
    }
  },
};

export const requestWikiResearch = {
  path: '/wiki-research' as const,
  handler: async (c: AppCtxJson<WikiResearchRequest>) => {
    const { record, result } = await researchWiki(c.req.valid('json'));
    if (record.status === 'failed') return c.json({ error: record.error ?? 'Wiki research failed.' }, 500);
    return c.json({ success: true, runId: record.runNodeId, ...result }, 202);
  },
};
