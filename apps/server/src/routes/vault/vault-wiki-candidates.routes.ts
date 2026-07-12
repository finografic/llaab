import { listNodes, readNodeByType } from '@llaab/core';
import { discoverWikiCandidates as runWikiDiscovery } from '@llaab/skills';
import type { AppCtx } from '../../types/app.types.js';

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
