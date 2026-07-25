import type { CanonicalIdeaNode } from './canonical-idea-node.schema.js';
import type { KnowledgeWikiPage } from './knowledge/wiki-page.schema.js';
import type { TranscriptNode } from './transcript-node.schema.js';

import { CanonicalIdeaNodeSchema } from './canonical-idea-node.schema.js';
import { KnowledgeWikiPageSchema } from './knowledge/wiki-page.schema.js';
import { TranscriptNodeSchema } from './transcript-node.schema.js';
import { createKnowledgeWikiFixture, createWikiFixtureCanonicalIdea } from './wiki.fixtures.js';

export const WIKI_TOPIC_DISCOVERY_FIXTURE_TIMESTAMP = '2026-07-19T00:00:00Z';

/** Plausible topic families for the broad Hermes multi-agent regression transcript. */
export const BROAD_HERMES_TOPIC_FAMILIES = [
  'isolation-architecture',
  'proactive-automation',
  'interaction-surfaces',
  'self-improvement',
  'context-memory',
  'least-privilege-security',
] as const;

export type BroadHermesTopicFamily = (typeof BROAD_HERMES_TOPIC_FAMILIES)[number];

/** Acceptable focused-wiki count for the broad fixture under the refined contract. */
export const BROAD_HERMES_EXPECTED_TOPIC_COUNT = { min: 5, max: 6 } as const;

const HERMES_TRANSCRIPT_BODY = [
  '<!-- t:0:10 -->',
  '',
  'Hermes multi-agent systems need isolation so agents do not share mutable runtime state.',
  '',
  '<!-- t:0:20 -->',
  '',
  'V8 isolates and sandboxes provide architecture boundaries without full container overhead.',
  '',
  '<!-- t:0:30 -->',
  '',
  'Proactive automation should watch for recurring operator tasks and propose one-shot runs.',
  '',
  '<!-- t:0:40 -->',
  '',
  'Automation must remain explicitly triggered; LLAAB does not own a scheduler.',
  '',
  '<!-- t:0:50 -->',
  '',
  'Interaction surfaces include Discord, terminal, and inbox triage for the same agent layer.',
  '',
  '<!-- t:1:00 -->',
  '',
  'Self-improvement loops should capture failed runs and regenerate skills from traces.',
  '',
  '<!-- t:1:10 -->',
  '',
  'Context and memory require compact retrieval rather than stuffing full transcripts.',
  '',
  '<!-- t:1:20 -->',
  '',
  'Shared memory is useful supporting context but must not collapse isolation boundaries.',
  '',
  '<!-- t:1:30 -->',
  '',
  'Least-privilege security means agents get only the vault and tool scopes they need.',
  '',
  '<!-- t:1:40 -->',
  '',
  'Secrets stay out of prompts; capability tokens are scoped per task.',
  '',
  '<!-- t:1:50 -->',
  '',
  'Cross-cutting note: context windows affect both isolation pressure and memory design.',
  '',
  '<!-- t:2:00 -->',
  '',
  'Closing remarks on Hermes gateway operations.',
].join('\n');

function idea(
  id: string,
  title: string,
  body: string,
  tags: string[],
  keyClaims: string[],
  transcriptId = 'hermes-multi-agent-transcript',
): CanonicalIdeaNode {
  return CanonicalIdeaNodeSchema.parse({
    id,
    type: 'canonical-idea',
    title,
    body,
    tags,
    related: [transcriptId],
    created_at: WIKI_TOPIC_DISCOVERY_FIXTURE_TIMESTAMP,
    status: 'seed',
    transcript_id: transcriptId,
    source_candidate_idea_ids: [],
    key_claims: keyClaims,
  });
}

/** Broad multi-agent/Hermes transcript: one channel, many timestamps, multiple domains. */
export function createBroadHermesTranscriptFixture(): TranscriptNode {
  return TranscriptNodeSchema.parse({
    id: 'hermes-multi-agent-transcript',
    type: 'transcript',
    title: 'Hermes multi-agent architecture and operations',
    tags: ['d:infra', 'd:automation', 'd:agents', 'hermes'],
    related: [],
    created_at: WIKI_TOPIC_DISCOVERY_FIXTURE_TIMESTAMP,
    status: 'seed',
    body: HERMES_TRANSCRIPT_BODY,
    source_id: 'hermes-channel-source',
    source_url: 'https://example.com/hermes-multi-agent',
    source_type: 'youtube',
    author: 'Hermes Channel',
    summary: 'Isolation, automation, surfaces, self-improvement, memory, and least privilege.',
    extracted_idea_ids: [],
  });
}

/**
 * Cross-cutting idea: primary for context-memory, supporting for isolation-architecture.
 * Remains one immutable canonical-idea node.
 */
export const CROSS_CUTTING_CONTEXT_IDEA_ID = 'idea-shared-context-pressure';

export function createBroadHermesCanonicalIdeasFixture(): CanonicalIdeaNode[] {
  return [
    idea(
      'idea-isolation-boundaries',
      'Keep agent runtimes isolated with sandboxes',
      'Multi-agent Hermes setups need hard isolation boundaries between agents.',
      ['d:infra', 'isolation', 'sandbox', 'v8-isolates'],
      ['Agents must not share mutable runtime state.', 'Sandboxes provide architecture boundaries.'],
    ),
    idea(
      'idea-isolation-v8',
      'Prefer V8 isolates over containers for lightweight tenancy',
      'V8 isolates give multi-tenant sandboxing without Docker overhead.',
      ['d:infra', 'isolation', 'v8-isolates'],
      ['V8 isolates are lighter than containers for agent tenancy.'],
    ),
    idea(
      'idea-proactive-automation',
      'Propose proactive one-shot automation for recurring tasks',
      'Watch for recurring operator work and propose explicit one-shot automation runs.',
      ['d:automation', 'proactive', 'one-shot'],
      ['Proactive automation proposes runs; it does not schedule them.'],
    ),
    idea(
      'idea-automation-trigger',
      'Keep automation explicitly triggered',
      'LLAAB automation stays one-shot and user/API triggered without an owned scheduler.',
      ['d:automation', 'one-shot', 'trigger'],
      ['No background watcher owns the schedule.'],
    ),
    idea(
      'idea-interaction-discord',
      'Expose Hermes through Discord and terminal surfaces',
      'Operators interact through Discord, terminal, and inbox triage against one agent layer.',
      ['d:integration', 'd:ui', 'discord', 'terminal', 'inbox'],
      ['Interaction surfaces share one Hermes agent layer.'],
    ),
    idea(
      'idea-self-improvement',
      'Capture failed runs to regenerate skills',
      'Self-improvement loops turn failed run traces into skill regeneration candidates.',
      ['d:meta', 'self-improvement', 'skills'],
      ['Failed runs are ingredients for skill regeneration.'],
    ),
    idea(
      CROSS_CUTTING_CONTEXT_IDEA_ID,
      'Context pressure couples memory design and isolation',
      'Large context windows increase irrelevant-context pressure and interact with isolation.',
      ['d:llm', 'context', 'memory', 'isolation'],
      [
        'Compact retrieval beats transcript stuffing.',
        'Shared memory must not collapse isolation boundaries.',
      ],
    ),
    idea(
      'idea-context-retrieval',
      'Use compact retrieval for agent memory',
      'Context and memory should prefer targeted retrieval over stuffing full transcripts.',
      ['d:llm', 'context', 'memory', 'retrieval'],
      ['Targeted retrieval keeps agent context focused.'],
    ),
    idea(
      'idea-least-privilege',
      'Scope agent tools with least privilege',
      'Agents receive only the vault and tool scopes required for the current task.',
      ['d:infra', 'security', 'least-privilege'],
      ['Capability tokens are scoped per task.'],
    ),
    idea(
      'idea-secrets-out-of-prompts',
      'Keep secrets out of agent prompts',
      'Secrets stay in env/vault stores; prompts receive scoped capability references only.',
      ['d:infra', 'security', 'secrets'],
      ['Do not embed secrets in prompts.'],
    ),
  ];
}

export function createBroadHermesFixture() {
  return {
    transcript: createBroadHermesTranscriptFixture(),
    canonicalIdeas: createBroadHermesCanonicalIdeasFixture(),
    expectedFamilies: BROAD_HERMES_TOPIC_FAMILIES,
    expectedTopicCount: BROAD_HERMES_EXPECTED_TOPIC_COUNT,
    crossCuttingIdeaId: CROSS_CUTTING_CONTEXT_IDEA_ID,
    /** Family membership hints for refined discovery assertions (not a schema quota). */
    familyPrimaryIdeaIds: {
      'isolation-architecture': ['idea-isolation-boundaries', 'idea-isolation-v8'],
      'proactive-automation': ['idea-proactive-automation', 'idea-automation-trigger'],
      'interaction-surfaces': ['idea-interaction-discord'],
      'self-improvement': ['idea-self-improvement'],
      'context-memory': [CROSS_CUTTING_CONTEXT_IDEA_ID, 'idea-context-retrieval'],
      'least-privilege-security': ['idea-least-privilege', 'idea-secrets-out-of-prompts'],
    } satisfies Record<BroadHermesTopicFamily, string[]>,
    /** Cross-cutting idea may also appear as supporting evidence for isolation. */
    supportingAssignments: {
      [CROSS_CUTTING_CONTEXT_IDEA_ID]: ['isolation-architecture'],
    },
  };
}

/** Focused single-topic transcript that should produce exactly one wiki. */
export function createSingleTopicFixture() {
  const transcript = TranscriptNodeSchema.parse({
    id: 'single-topic-transcript',
    type: 'transcript',
    title: 'Targeted retrieval for agent context',
    tags: ['d:llm', 'context'],
    related: [],
    created_at: WIKI_TOPIC_DISCOVERY_FIXTURE_TIMESTAMP,
    status: 'seed',
    body: [
      '<!-- t:0:10 -->',
      '',
      'Targeted retrieval keeps agent context focused.',
      '',
      '<!-- t:0:20 -->',
      '',
      'Compact evidence packets beat full-transcript stuffing.',
    ].join('\n'),
    source_id: 'context-channel-source',
    source_url: 'https://example.com/context-retrieval',
    source_type: 'youtube',
    author: 'Context Channel',
    extracted_idea_ids: [],
  });

  const canonicalIdeas = [
    createWikiFixtureCanonicalIdea({
      id: 'idea-targeted-retrieval',
      title: 'Use targeted retrieval for agent context',
      body: 'Targeted retrieval reduces irrelevant context.',
      tags: ['d:llm', 'context', 'retrieval'],
      transcript_id: transcript.id,
      key_claims: ['Targeted retrieval reduces irrelevant context.'],
    }),
    createWikiFixtureCanonicalIdea({
      id: 'idea-compact-packets',
      title: 'Prefer compact evidence packets',
      body: 'Evidence packets should stay bounded and relevant.',
      tags: ['d:llm', 'context', 'retrieval'],
      transcript_id: transcript.id,
      key_claims: ['Bounded evidence packets beat stuffing.'],
    }),
  ];

  return { transcript, canonicalIdeas, expectedTopicCount: 1 as const };
}

/** Already-covered material must resolve to existing wiki or safe update — never a duplicate. */
export function createAlreadyCoveredFixture() {
  const canonicalIdeas = [
    createWikiFixtureCanonicalIdea({
      id: 'idea-already-covered',
      title: 'Use targeted retrieval for agent context',
      body: 'Targeted retrieval reduces irrelevant context.',
      tags: ['d:llm', 'context'],
      key_claims: ['Targeted retrieval reduces irrelevant context.'],
    }),
  ];
  const existingWiki = createKnowledgeWikiFixture({
    id: 'context-management',
    topic_key: 'context-management',
    title: 'Context Management',
    source_canonical_idea_ids: ['idea-already-covered'],
    source_transcript_ids: ['context-transcript'],
  });
  return { canonicalIdeas, existingWiki, expectedOutcomes: ['existing-no-op', 'promoted-update'] as const };
}

/**
 * Ambiguous overlap with an existing wiki — refined path must never auto-suffix a create topic.
 */
export function createAmbiguousOverlapFixture() {
  const canonicalIdeas = [
    createWikiFixtureCanonicalIdea({
      id: 'idea-ambiguous-overlap',
      title: 'Context windows pressure agent memory',
      body: 'Overlaps an existing context management page without exact identity.',
      tags: ['d:llm', 'context', 'memory'],
      key_claims: ['Context pressure affects memory design.'],
    }),
  ];
  const competingWikis: KnowledgeWikiPage[] = [
    createKnowledgeWikiFixture({
      id: 'context-management',
      topic_key: 'context-management',
      title: 'Context Management',
      tags: ['d:llm', 'context'],
      source_canonical_idea_ids: ['other-context-idea'],
    }),
    createKnowledgeWikiFixture({
      id: 'agent-memory',
      topic_key: 'agent-memory',
      title: 'Agent Memory',
      tags: ['d:llm', 'memory'],
      source_canonical_idea_ids: ['other-memory-idea'],
    }),
  ];
  return {
    canonicalIdeas,
    competingWikis,
    forbiddenTopicKeys: ['context-management-2', 'agent-memory-2'] as const,
  };
}

/** Twelve timestamp refs from one transcript/channel — single-source, not contested. */
export function createSingleSourceNonConflictingFixture() {
  const sourceRefs = Array.from({ length: 12 }, (_, index) => ({
    id: `hermes-ref-${index + 1}`,
    kind: 'transcript' as const,
    node_id: 'hermes-multi-agent-transcript',
    verification: 'source-backed' as const,
    locator: `0:${(index + 1) * 10}`,
  }));
  return {
    transcript: createBroadHermesTranscriptFixture(),
    author: 'Hermes Channel',
    channel: 'Hermes Channel',
    sourceId: 'hermes-channel-source',
    sourceRefs,
    expectedVerification: 'source-backed' as const,
  };
}

/** Actual contradictory evidence groups — contested independent of citation count. */
export function createContestedEvidenceFixture() {
  return {
    claim: 'Agents should always share one global memory space.',
    contestedClaimEvidence: [
      {
        claim: 'Agents should always share one global memory space.',
        existing_source_ref_ids: ['isolation-ref'],
        incoming_source_ref_ids: ['shared-memory-ref'],
      },
    ],
    sourceRefs: [
      {
        id: 'isolation-ref',
        kind: 'transcript' as const,
        node_id: 'transcript-isolation',
        verification: 'source-backed' as const,
      },
      {
        id: 'shared-memory-ref',
        kind: 'transcript' as const,
        node_id: 'transcript-shared',
        verification: 'source-backed' as const,
      },
    ],
    expectedVerification: 'contested' as const,
  };
}

export interface RefinedMultiTopicExpectationInput {
  topicCount: number;
  /** Distinct topic keys or titles produced. */
  topicIdentities: string[];
  /** Family ids hit by the result (from BROAD_HERMES_TOPIC_FAMILIES). */
  familyHits: BroadHermesTopicFamily[];
}

/**
 * Assert refined one-step expectations for the broad Hermes fixture.
 * Does not require an exact topic count — only a coherent multi-topic range.
 */
export function assertRefinedBroadHermesExpectation(input: RefinedMultiTopicExpectationInput): void {
  if (input.topicCount === 1) {
    throw new Error('Refined contract forbids a single transcript-shaped mega-page.');
  }
  if (
    input.topicCount < BROAD_HERMES_EXPECTED_TOPIC_COUNT.min ||
    input.topicCount > BROAD_HERMES_EXPECTED_TOPIC_COUNT.max
  ) {
    throw new Error(
      `Expected ${BROAD_HERMES_EXPECTED_TOPIC_COUNT.min}-${BROAD_HERMES_EXPECTED_TOPIC_COUNT.max} focused topics, got ${input.topicCount}.`,
    );
  }
  if (new Set(input.topicIdentities).size !== input.topicIdentities.length) {
    throw new Error('Topic identities must be unique within a one-step batch.');
  }
  if (input.familyHits.length < 4) {
    throw new Error(`Expected at least 4 topic families, got ${input.familyHits.length}.`);
  }
}

/** Assert a cross-cutting idea is primary in one topic and supporting in another — one node id. */
export function assertCrossCuttingIdeaRoles(input: {
  ideaId: string;
  primaryInProposalIds: string[];
  supportingInProposalIds: string[];
}): void {
  if (input.primaryInProposalIds.length !== 1) {
    throw new Error(`Cross-cutting idea ${input.ideaId} must be primary in exactly one proposal.`);
  }
  if (input.supportingInProposalIds.length < 1) {
    throw new Error(`Cross-cutting idea ${input.ideaId} should support at least one other topic.`);
  }
  if (input.primaryInProposalIds.some((id) => input.supportingInProposalIds.includes(id))) {
    throw new Error(`Idea ${input.ideaId} cannot be primary and supporting in the same proposal.`);
  }
}

// Keep KnowledgeWikiPageSchema referenced for fixture typing stability.
void KnowledgeWikiPageSchema;
