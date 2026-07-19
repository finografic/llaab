import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as WikiSkills from '@llaab/skills';

const { compileWikiDraftsForTranscript } = vi.hoisted(() => ({
  compileWikiDraftsForTranscript: vi.fn(),
}));
const { autoPromoteWikiDrafts } = vi.hoisted(() => ({
  autoPromoteWikiDrafts: vi.fn(),
}));
const { linkWikiTopics } = vi.hoisted(() => ({
  linkWikiTopics: vi.fn(),
}));

vi.mock('./wiki-draft-generation.service.js', () => ({
  compileWikiDraftsForTranscript,
}));
vi.mock('./wiki-auto-promotion.service.js', () => ({
  autoPromoteWikiDrafts,
}));
vi.mock('@llaab/skills', async (importOriginal) => {
  const original = await importOriginal<typeof WikiSkills>();
  return {
    ...original,
    linkWikiTopics,
  };
});

describe('createTranscriptWikis', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'llaab-wiki-one-step-'));
    process.env.LLAAB_VAULT = join(root, 'vault');
    process.env.LLAAB_KNOWLEDGE = join(root, 'knowledge');
    compileWikiDraftsForTranscript.mockReset();
    autoPromoteWikiDrafts.mockReset();
    linkWikiTopics.mockReset();
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.LLAAB_VAULT;
    delete process.env.LLAAB_KNOWLEDGE;
    await rm(root, { force: true, recursive: true });
  });

  it('links then promotes and returns unified branch outcomes', async () => {
    const core = await import('@llaab/core');
    const created = await core.createNode({
      type: 'wiki-draft',
      id: 'draft-a',
      title: 'Isolation Boundaries',
      body: '<!-- wiki-section:overview -->\n\n## Overview\n\nBody.[^ref-1]',
      tags: ['isolation', 'd:agents'],
      extra: {
        topic_key: 'isolation-boundaries',
        operation: 'create',
        source_canonical_idea_ids: ['idea-a'],
        primary_canonical_idea_ids: ['idea-a'],
        source_refs: [{ id: 'ref-1', kind: 'transcript', verification: 'source-backed' }],
        quality_score: 90,
        proposed_links: [],
      },
    });
    const draft = await core.readNodeByType('wiki-draft', created.id);

    compileWikiDraftsForTranscript.mockResolvedValue({
      parentRunId: 'parent-run',
      discoveryBatchId: 'batch-1',
      compiled: [
        {
          record: {
            name: 'compile-wiki-draft',
            runNodeId: 'run-a',
            startedAt: '2026-07-19T00:00:00Z',
            status: 'completed',
          },
          result: {
            draftId: draft.id,
            operation: 'create',
            qualityScore: 90,
            warnings: [],
            coherenceFailed: false,
            normalizationActions: [],
            selectedCanonicalIdeaCount: 1,
            selectedTranscriptCount: 1,
            selectedSourceCount: 1,
            evidenceMetrics: {
              evidence_ref_count: 1,
              unique_canonical_idea_count: 1,
              unique_transcript_count: 1,
              unique_source_node_count: 1,
              unique_author_channel_count: 1,
              independent_source_count: 1,
              unknown_source_identity_count: 0,
            },
            producedNodeIds: [draft.id],
            evidence: [],
            runTrace: { stages: [], decisions: [] },
          },
        },
      ],
      branches: [
        {
          kind: 'compiled',
          proposalId: 'proposal-a',
          draftId: draft.id,
          runId: 'run-a',
          coherenceFailed: false,
          warnings: [],
        },
        {
          kind: 'no-op',
          proposalId: 'proposal-b',
          existingWikiId: 'existing-wiki',
          reason: 'Already represented.',
        },
      ],
    });

    await core.writeKnowledgeWiki({
      id: 'existing-wiki',
      type: 'wiki',
      topic_key: 'existing-wiki',
      title: 'Existing',
      aliases: [],
      summary: 'Existing',
      body: '<!-- wiki-section:overview -->\n\n## Overview\n\nExisting.[^e]',
      status: 'seed',
      tags: ['context'],
      links: [],
      source_refs: [{ id: 'e', kind: 'transcript', verification: 'source-backed' }],
      source_canonical_idea_ids: ['idea-b'],
      source_transcript_ids: ['t-b'],
      revision: 1,
      created_at: '2026-07-13T00:00:00Z',
      updated_at: '2026-07-13T00:00:00Z',
      verification_status: 'source-backed',
    });

    linkWikiTopics.mockResolvedValue({
      linksBySourceKey: new Map([
        [
          'isolation-boundaries',
          [
            {
              target_wiki_id: 'existing-wiki',
              relation: 'related-to',
              note: 'Isolation constraints shape how shared context is retrieved safely.',
            },
          ],
        ],
      ]),
      warnings: [],
      attempted: true,
    });

    const promotedPage = {
      id: 'isolation-boundaries',
      type: 'wiki' as const,
      topic_key: 'isolation-boundaries',
      title: 'Isolation Boundaries',
      aliases: [],
      summary: 'Isolation',
      body: draft.body,
      status: 'seed' as const,
      tags: draft.tags,
      links: [
        {
          target_wiki_id: 'existing-wiki',
          relation: 'related-to' as const,
          note: 'Isolation constraints shape how shared context is retrieved safely.',
        },
      ],
      source_refs: [{ id: 'ref-1', kind: 'transcript' as const, verification: 'source-backed' as const }],
      source_canonical_idea_ids: ['idea-a'],
      source_transcript_ids: ['t-a'],
      revision: 1,
      created_at: '2026-07-19T00:00:00Z',
      updated_at: '2026-07-19T00:00:00Z',
      verification_status: 'source-backed' as const,
    };

    autoPromoteWikiDrafts.mockResolvedValue({
      pages: [promotedPage],
      branches: [
        {
          draftId: draft.id,
          outcome: 'promoted-create',
          wikiId: promotedPage.id,
          wiki: promotedPage,
          warnings: [],
          reasons: ['Create passed auto-promotion gates.'],
        },
      ],
    });

    const { createTranscriptWikis } = await import('./wiki-one-step.service.js');
    const result = await createTranscriptWikis({
      transcriptId: 'transcript-1',
      body: { canonical_idea_ids: ['idea-a', 'idea-b'] },
    });

    expect(linkWikiTopics).toHaveBeenCalled();
    expect(autoPromoteWikiDrafts).toHaveBeenCalledWith([draft.id]);
    expect(result.success).toBe(true);
    expect(result.wikiIds).toEqual(expect.arrayContaining(['isolation-boundaries', 'existing-wiki']));
    expect(result.branches.map((branch) => branch.outcome).sort()).toEqual([
      'existing-no-op',
      'promoted-create',
    ]);
    expect((await core.readNodeByType('wiki-draft', draft.id)).proposed_links).toEqual([
      {
        target_wiki_id: 'existing-wiki',
        relation: 'related-to',
        note: 'Isolation constraints shape how shared context is retrieved safely.',
      },
    ]);
  });
});
