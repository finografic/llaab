import {
  getNodeFilePath,
  listKnowledgeWikis,
  listNodes,
  readNodeByType,
  updateNode,
  withKnowledgeWikiLock,
  writeKnowledgeWiki,
} from '@llaab/core';
import { formatIsoUtcSeconds } from '@llaab/schemas';
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

export const promoteWikiDraft = {
  path: '/wiki-drafts/:id/promote' as const,
  handler: async (c: AppCtx) => {
    const draftId = c.req.param('id') ?? '';
    try {
      const draft = await readNodeByType('wiki-draft', draftId);
      if (draft.draft_status !== 'proposed')
        {return c.json({ error: 'Only proposed wiki drafts can be promoted.' }, 409);}
      if (draft.operation !== 'create')
        {return c.json({ error: 'Only create drafts can be promoted in Phase 2.' }, 409);}

      const wiki = await withKnowledgeWikiLock(draft.topic_key, async () => {
        const existing = await listKnowledgeWikis();
        if (existing.some((page) => page.id === draft.topic_key || page.topic_key === draft.topic_key)) {
          throw new Error('A promoted wiki already represents this topic.');
        }
        const now = formatIsoUtcSeconds(new Date());
        const page = {
          id: draft.topic_key,
          type: 'wiki' as const,
          topic_key: draft.topic_key,
          title: draft.title,
          aliases: [],
          summary: draft.change_summary ?? '',
          body: draft.body,
          status: 'seed' as const,
          tags: draft.tags.filter((tag) => tag.startsWith('d:')),
          links: [],
          source_refs: draft.source_refs,
          source_canonical_idea_ids: draft.source_canonical_idea_ids,
          source_transcript_ids: draft.source_transcript_ids,
          revision: 1,
          created_at: now,
          updated_at: now,
          reviewed_at: now,
          verification_status: 'source-backed' as const,
        };
        return writeKnowledgeWiki(page);
      });

      await updateNode(getNodeFilePath('wiki-draft', draft.id), () => ({
        ...draft,
        draft_status: 'accepted',
        promoted_wiki_id: wiki.page.id,
        promoted_revision: wiki.page.revision,
        reviewed_at: wiki.page.reviewed_at,
      }));
      return c.json({ success: true, wiki: wiki.page, path: wiki.path });
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
      if (draft.draft_status !== 'proposed')
        {return c.json({ error: 'Only proposed wiki drafts can be rejected.' }, 409);}
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
