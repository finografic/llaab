import { readNodeByType } from '@llaab/core';
import type { AppCtx, AppCtxJson } from '../../types/app.types.js';
import type {
  CreateWikiDraftBody,
  EditWikiDraftBody,
  ResolveWikiDraftBody,
} from './vault-wiki-drafts.schema.js';

import { renderWikiBodyToHtml } from '../../lib/wiki-body-renderer.js';
import { listWikiDraftsQuerySchema } from './vault-wiki-drafts.schema.js';
import {
  applyWikiDraftEdit,
  listWikiDraftNodes,
  regenerateWikiDraftReview,
  rejectWikiDraftReview,
  resolveWikiDraftTopic,
} from './wiki-draft-review.service.js';
import { createTranscriptWikis } from './wiki-one-step.service.js';
import { promoteCreateWikiDraft, promoteUpdateWikiDraft } from './wiki-promotion.service.js';

export const createWikiDraft = {
  path: '/transcripts/:id/wiki-drafts' as const,
  handler: async (c: AppCtxJson<CreateWikiDraftBody>) => {
    const { id: transcriptId } = c.req.param() as { id: string };
    const body = c.req.valid('json');

    try {
      const result = await createTranscriptWikis({ transcriptId, body });
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: result.warnings[0] ?? 'Wiki creation produced no resulting pages.',
            runId: result.runId,
            runIds: result.runIds,
            draftIds: result.draftIds,
            branches: result.branches,
            warnings: result.warnings,
          },
          500,
        );
      }

      return c.json(
        {
          success: true,
          runId: result.runId,
          runIds: result.runIds,
          draftId: result.draftId,
          draftIds: result.draftIds,
          draftCount: result.draftCount,
          wikiId: result.wikiId!,
          wikiIds: result.wikiIds,
          wikiCount: result.wikiCount,
          wikis: result.wikis,
          branches: result.branches,
          qualityScore: result.qualityScore,
          warnings: result.warnings,
          producedNodeIds: result.draftIds,
        },
        201,
      );
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Wiki compilation failed.',
        },
        500,
      );
    }
  },
};

export const createResourceWikiDraft = {
  path: '/resources/:id/wiki-drafts' as const,
  handler: async (c: AppCtxJson<CreateWikiDraftBody>) => {
    const { id: transcriptId } = c.req.param() as { id: string };
    const body = c.req.valid('json');

    try {
      const result = await createTranscriptWikis({ transcriptId, body });
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: result.warnings[0] ?? 'Wiki creation produced no resulting pages.',
            runId: result.runId,
            runIds: result.runIds,
            draftIds: result.draftIds,
            branches: result.branches,
            warnings: result.warnings,
          },
          500,
        );
      }

      return c.json(
        {
          success: true,
          runId: result.runId,
          runIds: result.runIds,
          draftId: result.draftId,
          draftIds: result.draftIds,
          draftCount: result.draftCount,
          wikiId: result.wikiId!,
          wikiIds: result.wikiIds,
          wikiCount: result.wikiCount,
          wikis: result.wikis,
          branches: result.branches,
          qualityScore: result.qualityScore,
          warnings: result.warnings,
          producedNodeIds: result.draftIds,
        },
        201,
      );
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Wiki compilation failed.',
        },
        500,
      );
    }
  },
};

export const listWikiDrafts = {
  path: '/wiki-drafts' as const,
  handler: async (c: AppCtx) => {
    const query = listWikiDraftsQuerySchema.parse(Object.fromEntries(new URL(c.req.url).searchParams));
    return c.json(await listWikiDraftNodes(query));
  },
};

export const wikiDraftDetail = {
  path: '/wiki-drafts/:id' as const,
  handler: async (c: AppCtx) => {
    try {
      const draft = await readNodeByType('wiki-draft', c.req.param('id') ?? '');
      const bodyHtml = await renderWikiBodyToHtml(draft.body, draft.source_refs);
      return c.json({ draft, bodyHtml });
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
      return c.json({ success: true, draft: await rejectWikiDraftReview(draft) });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Wiki rejection failed.' }, 400);
    }
  },
};

export const regenerateWikiDraft = {
  path: '/wiki-drafts/:id/regenerate' as const,
  handler: async (c: AppCtx) => {
    try {
      const draft = await readNodeByType('wiki-draft', c.req.param('id') ?? '');
      return c.json({ success: true, ...(await regenerateWikiDraftReview(draft)) }, 201);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Wiki regeneration failed.' }, 400);
    }
  },
};

export const resolveWikiDraft = {
  path: '/wiki-drafts/:id/resolve-topic' as const,
  handler: async (c: AppCtxJson<ResolveWikiDraftBody>) => {
    try {
      const draft = await readNodeByType('wiki-draft', c.req.param('id') ?? '');
      const body = c.req.valid('json');
      return c.json({ success: true, ...(await resolveWikiDraftTopic(draft, body)) }, 201);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Wiki topic resolution failed.' }, 400);
    }
  },
};

export const editWikiDraft = {
  path: '/wiki-drafts/:id' as const,
  handler: async (c: AppCtxJson<EditWikiDraftBody>) => {
    try {
      const draft = await readNodeByType('wiki-draft', c.req.param('id') ?? '');
      const body = c.req.valid('json');
      return c.json({ success: true, draft: await applyWikiDraftEdit(draft, body) });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Wiki draft edit failed.' }, 400);
    }
  },
};
