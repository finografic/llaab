import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as WikiSkills from '@llaab/skills';

const { compileWikiDraft, discoverTranscriptWikiTopics } = vi.hoisted(() => ({
  compileWikiDraft: vi.fn(),
  discoverTranscriptWikiTopics: vi.fn(),
}));

vi.mock('@llaab/skills', async (importOriginal) => {
  const original = await importOriginal<typeof WikiSkills>();
  return {
    ...original,
    compileWikiDraft,
    discoverTranscriptWikiTopics,
  };
});

describe('compileWikiDraftsForTranscript Phase 3 orchestration', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'llaab-wiki-phase3-'));
    process.env.LLAAB_VAULT = join(root, 'vault');
    process.env.LLAAB_KNOWLEDGE = join(root, 'knowledge');
    compileWikiDraft.mockReset();
    discoverTranscriptWikiTopics.mockReset();
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.LLAAB_VAULT;
    delete process.env.LLAAB_KNOWLEDGE;
    await rm(root, { force: true, recursive: true });
  });

  it('compiles proposals independently, skips no-op, and preserves sibling success on failure', async () => {
    discoverTranscriptWikiTopics.mockResolvedValue({
      result: {
        discovery_batch_id: 'batch-1',
        selected_canonical_idea_ids: ['idea-a', 'idea-b', 'idea-c'],
        proposals: [
          {
            id: 'proposal-a',
            discovery_batch_id: 'batch-1',
            topic_key: 'topic-a',
            title: 'Topic A',
            rationale: 'Primary ideas cohere.',
            primary_canonical_idea_ids: ['idea-a'],
            supporting_canonical_idea_ids: [],
            domains: ['d:agents'],
            tags: ['isolation'],
            operation: 'create',
            coherence_score: 90,
            warnings: [],
            match_reasons: [],
          },
          {
            id: 'proposal-b',
            discovery_batch_id: 'batch-1',
            topic_key: 'topic-b',
            title: 'Topic B',
            rationale: 'Already covered.',
            primary_canonical_idea_ids: ['idea-b'],
            supporting_canonical_idea_ids: [],
            domains: ['d:llm'],
            tags: ['context'],
            operation: 'no-op',
            existing_wiki_id: 'wiki-b',
            coherence_score: 90,
            warnings: ['Already represented.'],
            match_reasons: [],
          },
          {
            id: 'proposal-c',
            discovery_batch_id: 'batch-1',
            topic_key: 'topic-c',
            title: 'Topic C',
            rationale: 'Will fail compile.',
            primary_canonical_idea_ids: ['idea-c'],
            supporting_canonical_idea_ids: [],
            domains: ['d:security'],
            tags: ['privilege'],
            operation: 'create',
            coherence_score: 90,
            warnings: [],
            match_reasons: [],
          },
        ],
        coverage: {
          primary_assigned_canonical_idea_ids: ['idea-a', 'idea-b', 'idea-c'],
          supporting_used_canonical_idea_ids: [],
          omitted_canonical_ideas: [],
        },
      },
      contentHash: 'hash',
      skipped: [],
      attempts: 1,
      usedModelReview: false,
    });

    compileWikiDraft.mockImplementation(
      async (input: {
        proposal?: { id?: string };
        canonicalIdeaIds: string[];
        parentRunId?: string;
        discoveryBatchId?: string;
      }) => {
        if (input.proposal?.id === 'proposal-c') {
          return {
            record: {
              name: 'compile-wiki-draft',
              runNodeId: 'run-c',
              startedAt: '2026-07-19T00:00:00Z',
              completedAt: '2026-07-19T00:00:01Z',
              status: 'failed',
              error: 'Model returned malformed JSON.',
            },
            result: undefined,
          };
        }
        expect(input.proposal?.id).toBe('proposal-a');
        expect(input.canonicalIdeaIds).toEqual(['idea-a']);
        expect(input.parentRunId).toEqual(expect.any(String));
        expect(input.discoveryBatchId).toBe('batch-1');
        return {
          record: {
            name: 'compile-wiki-draft',
            runNodeId: 'run-a',
            startedAt: '2026-07-19T00:00:00Z',
            completedAt: '2026-07-19T00:00:01Z',
            status: 'completed',
          },
          result: {
            draftId: 'draft-a',
            operation: 'create',
            qualityScore: 90,
            warnings: [],
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
            producedNodeIds: ['draft-a'],
            evidence: [],
            normalizationActions: ['replaced-source-refs-from-evidence'],
            coherenceFailed: false,
            runTrace: { stages: [], decisions: [] },
          },
        };
      },
    );

    const { compileWikiDraftsForTranscript } = await import('./wiki-draft-generation.service.js');
    const result = await compileWikiDraftsForTranscript({
      transcriptId: 'transcript-1',
      body: { canonical_idea_ids: ['idea-a', 'idea-b', 'idea-c'] },
    });

    expect(result.parentRunId).toEqual(expect.any(String));
    expect(result.discoveryBatchId).toBe('batch-1');
    expect(result.compiled).toHaveLength(1);
    expect(result.compiled[0]?.result.draftId).toBe('draft-a');
    expect(result.branches.map((branch) => branch.kind).sort()).toEqual(['compiled', 'failed', 'no-op']);
    expect(compileWikiDraft).toHaveBeenCalledTimes(2);
    expect(
      compileWikiDraft.mock.calls.every(
        ([call]) => !call.canonicalIdeaIds.includes('idea-b') || call.proposal?.id === 'proposal-a',
      ),
    ).toBe(true);
    // no-op never compiles; failed sibling does not erase successful draft.
    expect(compileWikiDraft.mock.calls.some(([call]) => call.proposal?.id === 'proposal-b')).toBe(false);
  });
});
