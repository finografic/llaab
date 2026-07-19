import { describe, expect, it } from 'vitest';

import { validateWikiDiscoveryResult } from './wiki-discovery.schema.js';
import { computeWikiEvidenceMetrics } from './wiki-evidence-metrics.js';
import {
  assertNoForbiddenDraftPromotionUx,
  containsForbiddenDraftPromotionUx,
  CreateTranscriptWikisRequestSchema,
  CreateTranscriptWikisResponseSchema,
  evaluateWikiAutoPromotionPolicy,
  isWikiOneStepOverallSuccess,
  shouldAttemptInternalCorrection,
  WIKI_ONE_STEP_INTERNAL_STAGES,
  WIKI_ONE_STEP_USER_ACTION,
} from './wiki-one-step.contract.js';
import {
  assertCrossCuttingIdeaRoles,
  assertRefinedBroadHermesExpectation,
  createAlreadyCoveredFixture,
  createAmbiguousOverlapFixture,
  createBroadHermesFixture,
  createContestedEvidenceFixture,
  createSingleSourceNonConflictingFixture,
  createSingleTopicFixture,
} from './wiki-topic-discovery.fixtures.js';
import { determineWikiVerificationStatus } from './wiki-verification.js';

describe('wiki one-step contract', () => {
  it('defines one public transcript operation with selected idea ids only', () => {
    expect(WIKI_ONE_STEP_USER_ACTION).toBe('create-wikis');
    expect(
      CreateTranscriptWikisRequestSchema.safeParse({
        canonical_idea_ids: ['idea-isolation-boundaries'],
        suggested_title: 'Nope',
      }).success,
    ).toBe(true);
    // Extra title fields are ignored by the public contract shape (strip unknown in callers).
    expect(CreateTranscriptWikisRequestSchema.parse({ canonical_idea_ids: ['idea-a'] })).toEqual({
      canonical_idea_ids: ['idea-a'],
    });
    expect(WIKI_ONE_STEP_INTERNAL_STAGES).toEqual([
      'discover',
      'validate-proposals',
      'compile',
      'link',
      'auto-promote',
    ]);
  });

  it('treats overall success as at least one promoted or existing match with partial siblings', () => {
    const response = CreateTranscriptWikisResponseSchema.parse({
      success: true,
      run_id: 'run-one-step',
      branches: [
        { outcome: 'promoted-create', wiki_id: 'agent-isolation', warnings: [] },
        { outcome: 'skipped', reason: 'Ambiguous topic overlap remained unresolved.', warnings: [] },
        { outcome: 'failed', reason: 'Compile validation failed after one retry.', warnings: [] },
      ],
      wikis: [],
      warnings: ['One topic skipped', 'One topic failed'],
    });

    expect(isWikiOneStepOverallSuccess(response.branches)).toBe(true);
    expect(
      isWikiOneStepOverallSuccess([
        { outcome: 'skipped', warnings: [] },
        { outcome: 'failed', warnings: [] },
      ]),
    ).toBe(false);
  });

  it('auto-promotion policy requires gates and never invents suffixed topics', () => {
    expect(
      evaluateWikiAutoPromotionPolicy({
        operation: 'create',
        verificationStatus: 'source-backed',
        qualityScore: 88,
        coherencePassed: true,
        evidenceGatesPassed: true,
        hasValidLinks: true,
        hasValidSourceRefs: true,
      }),
    ).toMatchObject({ allow: true, outcome: 'promoted-create' });

    expect(
      evaluateWikiAutoPromotionPolicy({
        operation: 'update',
        verificationStatus: 'source-backed',
        qualityScore: 90,
        coherencePassed: true,
        evidenceGatesPassed: true,
        hasValidLinks: true,
        hasValidSourceRefs: true,
        baseRevisionMatches: true,
      }).outcome,
    ).toBe('promoted-update');

    expect(
      evaluateWikiAutoPromotionPolicy({
        operation: 'no-op',
        verificationStatus: 'source-backed',
        qualityScore: 95,
        coherencePassed: true,
        evidenceGatesPassed: true,
        hasValidLinks: true,
        hasValidSourceRefs: true,
      }).outcome,
    ).toBe('existing-no-op');

    expect(
      evaluateWikiAutoPromotionPolicy({
        operation: 'needs-review',
        verificationStatus: 'source-backed',
        qualityScore: 90,
        coherencePassed: true,
        evidenceGatesPassed: true,
        hasValidLinks: true,
        hasValidSourceRefs: true,
      }),
    ).toMatchObject({ allow: false, outcome: 'skipped' });

    expect(
      evaluateWikiAutoPromotionPolicy({
        operation: 'create',
        verificationStatus: 'source-backed',
        qualityScore: 90,
        coherencePassed: true,
        evidenceGatesPassed: true,
        hasValidLinks: true,
        hasValidSourceRefs: true,
        inventedSuffixedTopicKey: true,
      }),
    ).toMatchObject({ allow: false, outcome: 'failed' });

    expect(
      evaluateWikiAutoPromotionPolicy({
        operation: 'update',
        verificationStatus: 'source-backed',
        qualityScore: 90,
        coherencePassed: true,
        evidenceGatesPassed: true,
        hasValidLinks: true,
        hasValidSourceRefs: true,
        baseRevisionMatches: false,
      }).allow,
    ).toBe(false);
  });

  it('bounds internal correction and forbids draft-promotion UX copy', () => {
    expect(shouldAttemptInternalCorrection({ attempt: 0, failureKind: 'malformed-output' })).toBe(true);
    expect(shouldAttemptInternalCorrection({ attempt: 1, failureKind: 'low-coherence' })).toBe(false);
    expect(shouldAttemptInternalCorrection({ attempt: 0, failureKind: 'terminal' })).toBe(false);

    expect(containsForbiddenDraftPromotionUx('Open the draft and promote it.')).toBe(true);
    expect(containsForbiddenDraftPromotionUx('Created 2 wiki pages.')).toBe(false);
    expect(() => assertNoForbiddenDraftPromotionUx(['Review /vault/wiki-drafts/abc then promote.'])).toThrow(
      /Forbidden draft-promotion UX/,
    );
  });
});

describe('wiki topic discovery regression corpus', () => {
  it('broad Hermes fixture spans multiple families and never implies one mega-page', () => {
    const fixture = createBroadHermesFixture();
    expect(fixture.canonicalIdeas.length).toBeGreaterThanOrEqual(8);
    expect(fixture.transcript.author).toBe('Hermes Channel');
    expect(fixture.transcript.body.match(/<!--\s*t:/g)?.length).toBeGreaterThanOrEqual(12);
    expect(fixture.expectedFamilies).toHaveLength(6);

    expect(() =>
      assertRefinedBroadHermesExpectation({
        topicCount: 1,
        topicIdentities: ['hermes-multi-agent-architecture-and-operations'],
        familyHits: [],
      }),
    ).toThrow(/mega-page/);

    expect(() =>
      assertRefinedBroadHermesExpectation({
        topicCount: 5,
        topicIdentities: [
          'agent-isolation',
          'proactive-automation',
          'interaction-surfaces',
          'self-improvement',
          'context-memory',
        ],
        familyHits: [
          'isolation-architecture',
          'proactive-automation',
          'interaction-surfaces',
          'self-improvement',
          'context-memory',
        ],
      }),
    ).not.toThrow();
  });

  it('allows a cross-cutting idea as primary in one topic and supporting in another', () => {
    const fixture = createBroadHermesFixture();
    assertCrossCuttingIdeaRoles({
      ideaId: fixture.crossCuttingIdeaId,
      primaryInProposalIds: ['proposal-context-memory'],
      supportingInProposalIds: ['proposal-isolation'],
    });

    const discovery = validateWikiDiscoveryResult(
      {
        discovery_batch_id: 'batch-broad-hermes',
        selected_canonical_idea_ids: fixture.canonicalIdeas.map((idea) => idea.id),
        proposals: [
          {
            id: 'proposal-isolation',
            discovery_batch_id: 'batch-broad-hermes',
            topic_key: 'agent-isolation',
            title: 'Agent Isolation Architecture',
            rationale: 'Isolation ideas form one reusable runtime boundary article.',
            primary_canonical_idea_ids: ['idea-isolation-boundaries', 'idea-isolation-v8'],
            supporting_canonical_idea_ids: [fixture.crossCuttingIdeaId],
            domains: ['d:infra'],
            tags: ['isolation', 'd:infra'],
            operation: 'create',
            coherence_score: 90,
            warnings: [],
          },
          {
            id: 'proposal-context-memory',
            discovery_batch_id: 'batch-broad-hermes',
            topic_key: 'agent-context-memory',
            title: 'Agent Context and Memory',
            rationale: 'Context/memory ideas synthesize retrieval and context pressure.',
            primary_canonical_idea_ids: [fixture.crossCuttingIdeaId, 'idea-context-retrieval'],
            supporting_canonical_idea_ids: [],
            domains: ['d:llm'],
            tags: ['context', 'memory', 'd:llm'],
            operation: 'create',
            coherence_score: 88,
            warnings: [],
          },
          {
            id: 'proposal-automation',
            discovery_batch_id: 'batch-broad-hermes',
            topic_key: 'proactive-automation',
            title: 'Proactive Automation',
            rationale: 'Automation ideas share one explicit-trigger topic.',
            primary_canonical_idea_ids: ['idea-proactive-automation', 'idea-automation-trigger'],
            supporting_canonical_idea_ids: [],
            domains: ['d:automation'],
            tags: ['automation', 'd:automation'],
            operation: 'create',
            coherence_score: 86,
            warnings: [],
          },
          {
            id: 'proposal-surfaces',
            discovery_batch_id: 'batch-broad-hermes',
            topic_key: 'interaction-surfaces',
            title: 'Agent Interaction Surfaces',
            rationale: 'Discord/terminal/inbox form one interaction topic.',
            primary_canonical_idea_ids: ['idea-interaction-discord'],
            supporting_canonical_idea_ids: [],
            domains: ['d:integration'],
            tags: ['discord', 'terminal', 'd:ui'],
            operation: 'create',
            coherence_score: 84,
            warnings: [],
          },
          {
            id: 'proposal-self-improvement',
            discovery_batch_id: 'batch-broad-hermes',
            topic_key: 'agent-self-improvement',
            title: 'Agent Self-Improvement',
            rationale: 'Failed-run skill regeneration is one reusable topic.',
            primary_canonical_idea_ids: ['idea-self-improvement'],
            supporting_canonical_idea_ids: [],
            domains: ['d:meta'],
            tags: ['self-improvement', 'd:meta'],
            operation: 'create',
            coherence_score: 82,
            warnings: [],
          },
          {
            id: 'proposal-security',
            discovery_batch_id: 'batch-broad-hermes',
            topic_key: 'least-privilege-security',
            title: 'Least-Privilege Agent Security',
            rationale: 'Scoped tools and secret hygiene form one security topic.',
            primary_canonical_idea_ids: ['idea-least-privilege', 'idea-secrets-out-of-prompts'],
            supporting_canonical_idea_ids: [],
            domains: ['d:infra'],
            tags: ['security', 'least-privilege', 'd:infra'],
            operation: 'create',
            coherence_score: 87,
            warnings: [],
          },
        ],
        coverage: {
          primary_assigned_canonical_idea_ids: [
            'idea-isolation-boundaries',
            'idea-isolation-v8',
            fixture.crossCuttingIdeaId,
            'idea-context-retrieval',
            'idea-proactive-automation',
            'idea-automation-trigger',
            'idea-interaction-discord',
            'idea-self-improvement',
            'idea-least-privilege',
            'idea-secrets-out-of-prompts',
          ],
          supporting_used_canonical_idea_ids: [fixture.crossCuttingIdeaId],
          omitted_canonical_ideas: [],
        },
      },
      { selectedCanonicalIdeaIds: fixture.canonicalIdeas.map((idea) => idea.id) },
    );

    expect(discovery.success).toBe(true);
    expect(discovery.result?.proposals).toHaveLength(6);
  });

  it('includes single-topic, already-covered, and ambiguous-overlap fixtures', () => {
    const single = createSingleTopicFixture();
    expect(single.expectedTopicCount).toBe(1);
    expect(single.canonicalIdeas).toHaveLength(2);

    const covered = createAlreadyCoveredFixture();
    expect(covered.existingWiki.source_canonical_idea_ids).toContain('idea-already-covered');
    expect(covered.expectedOutcomes).toEqual(expect.arrayContaining(['existing-no-op', 'promoted-update']));

    const ambiguous = createAmbiguousOverlapFixture();
    expect(ambiguous.competingWikis).toHaveLength(2);
    expect(ambiguous.forbiddenTopicKeys).toContain('context-management-2');
    expect(
      evaluateWikiAutoPromotionPolicy({
        operation: 'needs-review',
        verificationStatus: 'source-backed',
        qualityScore: 90,
        coherencePassed: true,
        evidenceGatesPassed: true,
        hasValidLinks: true,
        hasValidSourceRefs: true,
        inventedSuffixedTopicKey: true,
      }).allow,
    ).toBe(false);
  });

  it('keeps contested independent from single-source citation volume', () => {
    const singleSource = createSingleSourceNonConflictingFixture();
    const metrics = computeWikiEvidenceMetrics(
      singleSource.sourceRefs.map((ref) => ({
        id: ref.id,
        transcript_id: ref.node_id,
        source_id: singleSource.sourceId,
        author: singleSource.author,
        channel: singleSource.channel,
        kind: 'transcript' as const,
      })),
    );
    expect(metrics.evidence_ref_count).toBe(12);
    expect(metrics.unique_transcript_count).toBe(1);
    expect(metrics.unique_author_channel_count).toBe(1);
    expect(metrics.independent_source_count).toBe(1);
    expect(
      determineWikiVerificationStatus({
        sourceRefs: singleSource.sourceRefs,
        contestedClaimEvidence: [],
        evidenceMetrics: metrics,
      }),
    ).toBe('source-backed');

    const contested = createContestedEvidenceFixture();
    expect(
      determineWikiVerificationStatus({
        sourceRefs: contested.sourceRefs,
        contestedClaimEvidence: contested.contestedClaimEvidence,
        evidenceMetrics: computeWikiEvidenceMetrics(
          contested.sourceRefs.map((ref) => ({
            id: ref.id,
            transcript_id: ref.node_id,
            author: ref.node_id === 'transcript-isolation' ? 'Author A' : 'Author B',
            kind: 'transcript' as const,
          })),
        ),
      }),
    ).toBe('contested');

    expect(
      evaluateWikiAutoPromotionPolicy({
        operation: 'create',
        verificationStatus: 'contested',
        qualityScore: 95,
        coherencePassed: true,
        evidenceGatesPassed: true,
        hasValidLinks: true,
        hasValidSourceRefs: true,
        sourceRefs: contested.sourceRefs,
        contestedClaimEvidence: contested.contestedClaimEvidence,
      }),
    ).toMatchObject({ allow: false, outcome: 'skipped' });
  });
});
