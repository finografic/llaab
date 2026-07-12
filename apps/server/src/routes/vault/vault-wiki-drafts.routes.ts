import { listNodes, readNodeByType } from '@llaab/core';
import { compileWikiDraft } from '@llaab/skills';
import type { AppCtx, AppCtxJson } from '../../types/app.types.js';
import type { CreateWikiDraftBody } from './vault.schema.js';

export const createWikiDraft = {
  path: '/transcripts/:id/wiki-drafts' as const,
  handler: async (c: AppCtxJson<CreateWikiDraftBody>) => {
    const { id: transcriptId } = c.req.param() as { id: string };
    const body = c.req.valid('json');
    const { record, result } = await compileWikiDraft({
      transcriptId,
      canonicalIdeaIds: body.canonical_idea_ids,
      suggestedTitle: body.suggested_title,
      targetWikiId: body.target_wiki_id,
      entryPath: 'manual',
    });

    if (record.status === 'failed') {
      return c.json(
        { success: false, error: record.error ?? 'Wiki compilation failed.', runId: record.runNodeId },
        500,
      );
    }

    return c.json({ success: true, runId: record.runNodeId, ...result }, 201);
  },
};

export const listWikiDrafts = {
  path: '/wiki-drafts' as const,
  handler: async (c: AppCtx) => {
    const drafts = await listNodes({ type: 'wiki-draft' });
    return c.json({ drafts });
  },
};

export const wikiDraftDetail = {
  path: '/wiki-drafts/:id' as const,
  handler: async (c: AppCtx) => {
    try {
      const draft = await readNodeByType('wiki-draft', c.req.param('id') ?? '');
      return c.json({ draft });
    } catch {
      return c.json({ error: 'Wiki draft not found.' }, 404);
    }
  },
};
