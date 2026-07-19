import { readKnowledgeWiki, readNodeByType } from '@llaab/core';
import type { AppCtx, AppCtxJson } from '../../types/app.types.js';
import type {
  CreateWikiDraftBody,
  EditWikiDraftBody,
  ResolveWikiDraftBody,
} from './vault-wiki-drafts.schema.js';

import { renderWikiBodyToHtml } from '../../lib/wiki-body-renderer.js';
import { listWikiDraftsQuerySchema } from './vault-wiki-drafts.schema.js';
import { autoPromoteWikiDrafts } from './wiki-auto-promotion.service.js';
import { compileWikiDraftsForTranscript } from './wiki-draft-generation.service.js';
import {
  applyWikiDraftEdit,
  listWikiDraftNodes,
  regenerateWikiDraftReview,
  rejectWikiDraftReview,
  resolveWikiDraftTopic,
} from './wiki-draft-review.service.js';
import { promoteCreateWikiDraft, promoteUpdateWikiDraft } from './wiki-promotion.service.js';

export const createWikiDraft = {
  path: '/transcripts/:id/wiki-drafts' as const,
  handler: async (c: AppCtxJson<CreateWikiDraftBody>) => {
    const { id: transcriptId } = c.req.param() as { id: string };
    const body = c.req.valid('json');

    let orchestration: Awaited<ReturnType<typeof compileWikiDraftsForTranscript>>;
    try {
      orchestration = await compileWikiDraftsForTranscript({
        transcriptId,
        body,
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Wiki compilation failed.',
        },
        500,
      );
    }

    const { parentRunId, branches, compiled } = orchestration;
    const promoteableDraftIds = compiled
      .filter(({ result }) => result && !result.coherenceFailed)
      .map(({ result }) => result.draftId);
    const wikis = promoteableDraftIds.length > 0 ? await autoPromoteWikiDrafts(promoteableDraftIds) : [];

    for (const branch of branches) {
      if (branch.kind !== 'no-op') continue;
      try {
        const existing = await readKnowledgeWiki(branch.existingWikiId);
        if (!wikis.some((wiki) => wiki.id === existing.id)) wikis.push(existing);
      } catch {
        // Existing wiki missing — surface as warning below.
      }
    }

    const wikiIds = wikis.map((wiki) => wiki.id);
    const draftIds = compiled.flatMap(({ result }) => (result?.draftId ? [result.draftId] : []));
    const runIds = [parentRunId, ...compiled.map(({ record }) => record.runNodeId)];
    const warnings = [
      ...compiled.flatMap(({ result }) => result?.warnings ?? []),
      ...branches.flatMap((branch) => {
        if (branch.kind === 'failed') return [`Failed topic: ${branch.reason}`];
        if (branch.kind === 'skipped') return [`Skipped topic: ${branch.reason}`];
        if (branch.kind === 'compiled' && branch.coherenceFailed) {
          return ['Coherence gate failed; draft retained for audit and was not auto-promoted.'];
        }
        return [];
      }),
    ];

    const hasPromotedOrExisting = wikiIds.length > 0;
    if (!hasPromotedOrExisting) {
      return c.json(
        {
          success: false,
          error: warnings[0] ?? 'Wiki compilation produced no promotable pages.',
          runId: parentRunId,
          runIds,
          draftIds,
          branches,
        },
        500,
      );
    }

    const evidenceMetrics = compiled.reduce(
      (acc, { result }) => {
        if (!result) return acc;
        return {
          evidence_ref_count: acc.evidence_ref_count + result.evidenceMetrics.evidence_ref_count,
          unique_canonical_idea_count:
            acc.unique_canonical_idea_count + result.evidenceMetrics.unique_canonical_idea_count,
          unique_transcript_count: Math.max(
            acc.unique_transcript_count,
            result.evidenceMetrics.unique_transcript_count,
          ),
          unique_source_node_count: Math.max(
            acc.unique_source_node_count,
            result.evidenceMetrics.unique_source_node_count,
          ),
          unique_author_channel_count: Math.max(
            acc.unique_author_channel_count,
            result.evidenceMetrics.unique_author_channel_count,
          ),
          independent_source_count: Math.max(
            acc.independent_source_count,
            result.evidenceMetrics.independent_source_count,
          ),
          unknown_source_identity_count:
            acc.unknown_source_identity_count + result.evidenceMetrics.unknown_source_identity_count,
        };
      },
      {
        evidence_ref_count: 0,
        unique_canonical_idea_count: 0,
        unique_transcript_count: 0,
        unique_source_node_count: 0,
        unique_author_channel_count: 0,
        independent_source_count: 0,
        unknown_source_identity_count: 0,
      },
    );

    return c.json(
      {
        success: true,
        runId: parentRunId,
        runIds,
        draftId: draftIds[0],
        draftIds,
        draftCount: draftIds.length,
        wikiId: wikiIds[0]!,
        wikiIds,
        wikiCount: wikiIds.length,
        wikis,
        qualityScore:
          compiled.length > 0 ? Math.min(...compiled.map(({ result }) => result?.qualityScore ?? 0)) : 100,
        warnings,
        branches,
        selectedCanonicalIdeaCount: compiled.reduce(
          (total, { result }) => total + (result?.selectedCanonicalIdeaCount ?? 0),
          0,
        ),
        selectedTranscriptCount: Math.max(
          0,
          ...compiled.map(({ result }) => result?.selectedTranscriptCount ?? 0),
        ),
        selectedSourceCount: evidenceMetrics.unique_source_node_count,
        evidenceMetrics,
        producedNodeIds: draftIds,
      },
      201,
    );
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
