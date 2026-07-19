import { describe, expect, it } from 'vitest';

import { WikiCandidateNodeSchema } from './wiki-candidate-node.schema.js';
import {
  WikiDiscoveryResultSchema,
  WikiTopicProposalSchema,
  validateWikiDiscoveryResult,
} from './wiki-discovery.schema.js';
import { WikiDraftNodeSchema } from './wiki-draft-node.schema.js';
import { createWikiFixtureDraft } from './wiki.fixtures.js';

const createdAt = '2026-07-19T00:00:00Z';

function proposal(overrides: Record<string, unknown> = {}) {
  return WikiTopicProposalSchema.parse({
    id: 'proposal-isolation',
    discovery_batch_id: 'batch-hermes-1',
    topic_key: 'agent-isolation',
    title: 'Agent Isolation Architecture',
    rationale: 'Primary ideas share one reusable isolation topic.',
    primary_canonical_idea_ids: ['idea-isolation'],
    supporting_canonical_idea_ids: ['idea-shared-context'],
    domains: ['d:infra'],
    tags: ['isolation', 'd:infra'],
    operation: 'create',
    coherence_score: 88,
    warnings: [],
    ...overrides,
  });
}

describe('wiki discovery contracts', () => {
  it('round-trips a valid proposal and discovery result', () => {
    const result = WikiDiscoveryResultSchema.parse({
      discovery_batch_id: 'batch-hermes-1',
      selected_canonical_idea_ids: ['idea-isolation', 'idea-shared-context', 'idea-noise'],
      proposals: [proposal()],
      coverage: {
        primary_assigned_canonical_idea_ids: ['idea-isolation'],
        supporting_used_canonical_idea_ids: ['idea-shared-context'],
        omitted_canonical_ideas: [{ id: 'idea-noise', reason: 'Not wiki-worthy on its own.' }],
      },
    });

    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]?.primary_canonical_idea_ids).toEqual(['idea-isolation']);
    expect(
      validateWikiDiscoveryResult(result, {
        selectedCanonicalIdeaIds: ['idea-isolation', 'idea-shared-context', 'idea-noise'],
      }).success,
    ).toBe(true);
  });

  it('rejects overlapping primary/supporting roles inside one proposal', () => {
    const parsed = WikiTopicProposalSchema.safeParse({
      id: 'proposal-isolation',
      discovery_batch_id: 'batch-hermes-1',
      topic_key: 'agent-isolation',
      title: 'Agent Isolation Architecture',
      rationale: 'Primary ideas share one reusable isolation topic.',
      primary_canonical_idea_ids: ['idea-isolation', 'idea-shared-context'],
      supporting_canonical_idea_ids: ['idea-shared-context'],
      domains: ['d:infra'],
      tags: ['isolation', 'd:infra'],
      operation: 'create',
      coherence_score: 88,
      warnings: [],
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects invented ids, duplicate topics, and unaccounted selected ideas', () => {
    const invalid = validateWikiDiscoveryResult(
      {
        discovery_batch_id: 'batch-hermes-1',
        selected_canonical_idea_ids: ['idea-isolation', 'idea-shared-context'],
        proposals: [
          proposal(),
          proposal({
            id: 'proposal-dupe',
            topic_key: 'agent-isolation',
            title: 'Agent Isolation Architecture',
            primary_canonical_idea_ids: ['idea-invented'],
            supporting_canonical_idea_ids: [],
          }),
        ],
        coverage: {
          primary_assigned_canonical_idea_ids: ['idea-isolation'],
          supporting_used_canonical_idea_ids: ['idea-shared-context'],
          omitted_canonical_ideas: [],
        },
      },
      {
        selectedCanonicalIdeaIds: ['idea-isolation', 'idea-shared-context', 'idea-unaccounted'],
        existingWikiIds: new Set(['existing-wiki']),
      },
    );

    expect(invalid.success).toBe(false);
    expect(invalid.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'duplicate-topic-key',
        'duplicate-title',
        'invented-primary-id',
        'unaccounted-selected-idea',
      ]),
    );
  });

  it('allows the same idea as supporting in multiple proposals while primary once', () => {
    const validated = validateWikiDiscoveryResult(
      {
        discovery_batch_id: 'batch-hermes-1',
        selected_canonical_idea_ids: ['idea-a', 'idea-b', 'idea-shared'],
        proposals: [
          proposal({
            id: 'proposal-a',
            topic_key: 'topic-a',
            title: 'Topic A',
            primary_canonical_idea_ids: ['idea-a'],
            supporting_canonical_idea_ids: ['idea-shared'],
          }),
          proposal({
            id: 'proposal-b',
            topic_key: 'topic-b',
            title: 'Topic B',
            primary_canonical_idea_ids: ['idea-b'],
            supporting_canonical_idea_ids: ['idea-shared'],
          }),
        ],
        coverage: {
          primary_assigned_canonical_idea_ids: ['idea-a', 'idea-b'],
          supporting_used_canonical_idea_ids: ['idea-shared'],
          omitted_canonical_ideas: [],
        },
      },
      { selectedCanonicalIdeaIds: ['idea-a', 'idea-b', 'idea-shared'] },
    );

    expect(validated.success).toBe(true);
  });

  it('reads legacy wiki-candidate and wiki-draft nodes with role defaults', () => {
    const candidate = WikiCandidateNodeSchema.parse({
      id: 'legacy-candidate',
      type: 'wiki-candidate',
      title: 'Legacy candidate',
      created_at: createdAt,
      status: 'seed',
      body: '',
      tags: [],
      related: [],
      topic_key: 'legacy-topic',
      source_canonical_idea_ids: ['idea-isolation'],
      source_transcript_ids: ['transcript-1'],
      heat_score: 40,
      novelty_score: 40,
      recommendation: 'create',
    });
    expect(candidate.primary_canonical_idea_ids).toEqual([]);
    expect(candidate.supporting_canonical_idea_ids).toEqual([]);

    const draft = WikiDraftNodeSchema.parse(createWikiFixtureDraft());
    expect(draft.primary_canonical_idea_ids).toEqual([]);
    expect(draft.evidence_metrics).toBeUndefined();
  });

  it('does not impose a proposal-count quota', () => {
    expect(
      WikiDiscoveryResultSchema.safeParse({
        discovery_batch_id: 'batch-empty',
        selected_canonical_idea_ids: ['idea-a'],
        proposals: [],
        coverage: {
          primary_assigned_canonical_idea_ids: [],
          supporting_used_canonical_idea_ids: [],
          omitted_canonical_ideas: [{ id: 'idea-a', reason: 'Not suitable.' }],
        },
      }).success,
    ).toBe(true);
  });
});
