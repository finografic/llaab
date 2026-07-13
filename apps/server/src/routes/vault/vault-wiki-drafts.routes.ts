import { getNodeFilePath, listNodes, readNodeByType, updateNode } from '@llaab/core';
import { formatIsoUtcSeconds } from '@llaab/schemas';
import { compileWikiDraft } from '@llaab/skills';
import type { AppCtx, AppCtxJson } from '../../types/app.types.js';
import type { CreateWikiDraftBody, EditWikiDraftBody, ResolveWikiDraftBody } from './vault.schema.js';
import type { WikiDraftNode } from '@llaab/schemas';

import { listWikiDraftsQuerySchema } from './vault.schema.js';
import { promoteCreateWikiDraft, promoteUpdateWikiDraft } from './wiki-promotion.service.js';

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
    const query = listWikiDraftsQuerySchema.parse(Object.fromEntries(new URL(c.req.url).searchParams));
    const drafts = (await listNodes({ type: 'wiki-draft' }))
      .filter((node): node is WikiDraftNode => node.type === 'wiki-draft')
      .filter((draft) => (query.status ? draft.draft_status === query.status : true))
      .filter((draft) => (query.topic ? draft.topic_key.includes(query.topic) : true))
      .filter((draft) => (query.target ? draft.target_wiki_id === query.target : true));
    return c.json({ drafts: drafts.slice(query.offset, query.offset + query.limit), total: drafts.length });
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
      const wiki =
        draft.operation === 'create'
          ? await promoteCreateWikiDraft(draft)
          : await promoteUpdateWikiDraft(draft);
      return c.json({
        success: true,
        wiki: wiki.page,
        path: wiki.path,
        recovered: 'recovered' in wiki && wiki.recovered,
      });
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
        review_decisions: [
          ...draft.review_decisions,
          { at: reviewedAt, decision: 'rejected', reason: 'Rejected by explicit review action.' },
        ],
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

export const resolveWikiDraft = {
  path: '/wiki-drafts/:id/resolve-topic' as const,
  handler: async (c: AppCtxJson<ResolveWikiDraftBody>) => {
    try {
      const draft = await readNodeByType('wiki-draft', c.req.param('id') ?? '');
      if (draft.draft_status !== 'proposed' || draft.operation !== 'needs-review') {
        return c.json({ error: 'Only proposed ambiguous wiki drafts can resolve a topic.' }, 409);
      }
      const body = c.req.valid('json');
      if (body.distinct_topic_key) {
        const result = await updateNode(getNodeFilePath('wiki-draft', draft.id), () => ({
          ...draft,
          operation: 'create',
          topic_key: body.distinct_topic_key ?? draft.topic_key,
          topic_matches: [],
          warning: 'Reviewer confirmed this is a distinct topic.',
          reviewer_edits: true,
        }));
        return c.json({ success: true, draft: result.node });
      }
      const targetWikiId = body.target_wiki_id;
      if (!targetWikiId || !draft.topic_matches.some((match) => match.wiki_id === targetWikiId)) {
        return c.json({ error: 'Select one of the recorded topic-match targets.' }, 400);
      }
      const transcriptId = draft.source_transcript_ids[0];
      if (!transcriptId || draft.source_canonical_idea_ids.length === 0) {
        return c.json({ error: 'Wiki draft does not retain enough lineage to regenerate.' }, 409);
      }
      const { record, result } = await compileWikiDraft({
        transcriptId,
        canonicalIdeaIds: draft.source_canonical_idea_ids,
        suggestedTitle: draft.title,
        targetWikiId,
        entryPath: 'manual',
      });
      if (record.status === 'failed') {
        return c.json({ success: false, error: record.error ?? 'Wiki target resolution failed.' }, 500);
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
      const knownSourceRefIds = new Set(draft.source_refs.map((sourceRef) => sourceRef.id));
      if (body.sections?.some((section) => section.source_ref_ids.some((id) => !knownSourceRefIds.has(id)))) {
        return c.json({ error: 'Edited section references an unknown source reference.' }, 400);
      }
      const renderedBody = body.sections
        ?.map((section) => {
          const citations = section.source_ref_ids.map((sourceRefId) => `[^${sourceRefId}]`).join(' ');
          return `<!-- wiki-section:${section.id} -->\n\n## ${section.heading}\n\n${section.body}${citations ? ` ${citations}` : ''}`;
        })
        .join('\n\n');
      const result = await updateNode(getNodeFilePath('wiki-draft', draft.id), () => ({
        ...draft,
        ...(body.title ? { title: body.title } : {}),
        ...(body.summary ? { change_summary: body.summary } : {}),
        ...(body.sections ? { sections: body.sections, body: renderedBody } : {}),
        reviewer_edits: true,
      }));
      return c.json({ success: true, draft: result.node });
    } catch {
      return c.json({ error: 'Wiki draft not found.' }, 404);
    }
  },
};
