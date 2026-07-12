import { getNodeFilePath, listNodes, readNodeByType, updateNode } from '@llaab/core';
import { formatIsoUtcSeconds } from '@llaab/schemas';
import { compileWikiDraft } from '@llaab/skills';
import type { AppCtx, AppCtxJson } from '../../types/app.types.js';
import type { CreateWikiDraftBody, EditWikiDraftBody } from './vault.schema.js';

import { promoteCreateWikiDraft } from './wiki-promotion.service.js';

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

export const promoteWikiDraft = {
  path: '/wiki-drafts/:id/promote' as const,
  handler: async (c: AppCtx) => {
    const draftId = c.req.param('id') ?? '';
    try {
      const draft = await readNodeByType('wiki-draft', draftId);
      const wiki = await promoteCreateWikiDraft(draft);
      return c.json({ success: true, wiki: wiki.page, path: wiki.path, recovered: wiki.recovered });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Wiki promotion failed.' }, 400);
    }
  },
};

export const rejectWikiDraft = {
  path: '/wiki-drafts/:id/reject' as const,
  handler: async (c: AppCtx) => {
    try {
      const draft = await readNodeByType('wiki-draft', c.req.param('id') ?? '');
      if (draft.draft_status !== 'proposed') {
        return c.json({ error: 'Only proposed wiki drafts can be rejected.' }, 409);
      }
      const reviewedAt = formatIsoUtcSeconds(new Date());
      const result = await updateNode(getNodeFilePath('wiki-draft', draft.id), () => ({
        ...draft,
        draft_status: 'rejected',
        reviewed_at: reviewedAt,
      }));
      return c.json({ success: true, draft: result.node });
    } catch {
      return c.json({ error: 'Wiki draft not found.' }, 404);
    }
  },
};

export const regenerateWikiDraft = {
  path: '/wiki-drafts/:id/regenerate' as const,
  handler: async (c: AppCtx) => {
    try {
      const draft = await readNodeByType('wiki-draft', c.req.param('id') ?? '');
      if (draft.draft_status !== 'proposed') {
        return c.json({ error: 'Only proposed wiki drafts can be regenerated.' }, 409);
      }
      const transcriptId = draft.source_transcript_ids[0];
      if (!transcriptId || draft.source_canonical_idea_ids.length === 0) {
        return c.json({ error: 'Wiki draft does not retain enough lineage to regenerate.' }, 409);
      }
      const { record, result } = await compileWikiDraft({
        transcriptId,
        canonicalIdeaIds: draft.source_canonical_idea_ids,
        suggestedTitle: draft.title,
        entryPath: 'manual',
      });
      if (record.status === 'failed') {
        return c.json({ success: false, error: record.error ?? 'Wiki regeneration failed.' }, 500);
      }
      await updateNode(getNodeFilePath('wiki-draft', draft.id), () => ({
        ...draft,
        draft_status: 'superseded',
        reviewed_at: formatIsoUtcSeconds(new Date()),
      }));
      return c.json({ success: true, runId: record.runNodeId, draftId: result.draftId }, 201);
    } catch {
      return c.json({ error: 'Wiki draft not found.' }, 404);
    }
  },
};

export const editWikiDraft = {
  path: '/wiki-drafts/:id' as const,
  handler: async (c: AppCtxJson<EditWikiDraftBody>) => {
    try {
      const draft = await readNodeByType('wiki-draft', c.req.param('id') ?? '');
      if (draft.draft_status !== 'proposed') {
        return c.json({ error: 'Only proposed wiki drafts can be edited.' }, 409);
      }
      const body = c.req.valid('json');
      const result = await updateNode(getNodeFilePath('wiki-draft', draft.id), () => ({
        ...draft,
        ...(body.title ? { title: body.title } : {}),
        ...(body.summary ? { change_summary: body.summary } : {}),
        reviewer_edits: true,
      }));
      return c.json({ success: true, draft: result.node });
    } catch {
      return c.json({ error: 'Wiki draft not found.' }, 404);
    }
  },
};
