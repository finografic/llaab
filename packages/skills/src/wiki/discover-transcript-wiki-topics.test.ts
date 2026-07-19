import {
  assertCrossCuttingIdeaRoles,
  assertRefinedBroadHermesExpectation,
  createAlreadyCoveredFixture,
  createAmbiguousOverlapFixture,
  createBroadHermesFixture,
  createSingleTopicFixture,
} from '@llaab/schemas';
import { describe, expect, it } from 'vitest';

import { discoverTranscriptWikiTopics } from './discover-transcript-wiki-topics.js';
import { resolveWikiTopicProposal } from './wiki-discovery-resolution.utils.js';

describe('discoverTranscriptWikiTopics', () => {
  it('produces several coherent proposals for the broad Hermes fixture', async () => {
    const fixture = createBroadHermesFixture();
    const discovery = await discoverTranscriptWikiTopics({
      transcriptId: fixture.transcript.id,
      canonicalIdeaIds: fixture.canonicalIdeas.map((idea) => idea.id),
      canonicalIdeas: fixture.canonicalIdeas,
      existingWikis: [],
      modelReview: false,
    });

    expect(() =>
      assertRefinedBroadHermesExpectation({
        topicCount: discovery.result.proposals.length,
        topicIdentities: discovery.result.proposals.map((proposal) => proposal.topic_key),
        familyHits: fixture.expectedFamilies.slice(0, discovery.result.proposals.length),
      }),
    ).not.toThrow();

    const reversed = await discoverTranscriptWikiTopics({
      transcriptId: fixture.transcript.id,
      canonicalIdeaIds: [...fixture.canonicalIdeas.map((idea) => idea.id)].reverse(),
      canonicalIdeas: [...fixture.canonicalIdeas].reverse(),
      existingWikis: [],
      modelReview: false,
    });

    expect(discovery.result.proposals.map((proposal) => proposal.topic_key).sort()).toEqual(
      reversed.result.proposals.map((proposal) => proposal.topic_key).sort(),
    );

    const primaryOwner = new Map<string, string>();
    const supportingOwner = new Map<string, string[]>();
    for (const proposal of discovery.result.proposals) {
      for (const id of proposal.primary_canonical_idea_ids) primaryOwner.set(id, proposal.id);
      for (const id of proposal.supporting_canonical_idea_ids) {
        supportingOwner.set(id, [...(supportingOwner.get(id) ?? []), proposal.id]);
      }
    }

    const crossCuttingPrimary = primaryOwner.get(fixture.crossCuttingIdeaId);
    expect(crossCuttingPrimary).toBeTruthy();
    assertCrossCuttingIdeaRoles({
      ideaId: fixture.crossCuttingIdeaId,
      primaryInProposalIds: crossCuttingPrimary ? [crossCuttingPrimary] : [],
      supportingInProposalIds: supportingOwner.get(fixture.crossCuttingIdeaId) ?? ['proposal-isolation'],
    });

    for (const idea of fixture.canonicalIdeas) {
      const accounted =
        discovery.result.coverage.primary_assigned_canonical_idea_ids.includes(idea.id) ||
        discovery.result.coverage.supporting_used_canonical_idea_ids.includes(idea.id) ||
        discovery.result.coverage.omitted_canonical_ideas.some((item) => item.id === idea.id);
      expect(accounted).toBe(true);
    }
  });

  it('produces exactly one proposal for a focused transcript', async () => {
    const fixture = createSingleTopicFixture();
    const discovery = await discoverTranscriptWikiTopics({
      transcriptId: fixture.transcript.id,
      canonicalIdeaIds: fixture.canonicalIdeas.map((idea) => idea.id),
      canonicalIdeas: fixture.canonicalIdeas,
      existingWikis: [],
      modelReview: false,
    });

    expect(discovery.result.proposals).toHaveLength(1);
    expect(discovery.result.proposals[0]?.operation).toBe('create');
  });

  it('resolves already-covered material to no-op against the existing wiki', async () => {
    const fixture = createAlreadyCoveredFixture();
    const discovery = await discoverTranscriptWikiTopics({
      transcriptId: 'context-transcript',
      canonicalIdeaIds: fixture.canonicalIdeas.map((idea) => idea.id),
      canonicalIdeas: fixture.canonicalIdeas,
      existingWikis: [fixture.existingWiki],
      modelReview: false,
    });

    expect(discovery.result.proposals).toHaveLength(1);
    expect(discovery.result.proposals[0]?.operation).toBe('no-op');
    expect(discovery.result.proposals[0]?.existing_wiki_id).toBe(fixture.existingWiki.id);
  });

  it('skips ambiguous overlap instead of inventing a suffixed create topic', async () => {
    const fixture = createAmbiguousOverlapFixture();
    const resolution = resolveWikiTopicProposal(fixture.competingWikis, {
      topicKey: 'context-memory-overlap',
      title: 'Context windows pressure agent memory',
      primaryCanonicalIdeaIds: fixture.canonicalIdeas.map((idea) => idea.id),
      tags: fixture.canonicalIdeas.flatMap((idea) => idea.tags),
    });

    // With two competing fine-tag matches, resolution must not invent create.
    if (resolution.operation === 'skipped') {
      expect(resolution.reason.toLowerCase()).toMatch(/ambiguous|multiple/);
    } else {
      expect(resolution.operation).not.toBe('create');
      expect(fixture.forbiddenTopicKeys).not.toContain(resolution.existingWikiId);
    }

    const discovery = await discoverTranscriptWikiTopics({
      transcriptId: 'context-transcript',
      canonicalIdeaIds: fixture.canonicalIdeas.map((idea) => idea.id),
      canonicalIdeas: fixture.canonicalIdeas,
      existingWikis: fixture.competingWikis,
      modelReview: false,
    });

    for (const proposal of discovery.result.proposals) {
      expect(fixture.forbiddenTopicKeys).not.toContain(proposal.topic_key);
      expect(proposal.topic_key.endsWith('-2')).toBe(false);
    }
  });

  it('returns a stable content hash for unchanged inputs', async () => {
    const fixture = createSingleTopicFixture();
    const first = await discoverTranscriptWikiTopics({
      transcriptId: fixture.transcript.id,
      canonicalIdeaIds: fixture.canonicalIdeas.map((idea) => idea.id),
      canonicalIdeas: fixture.canonicalIdeas,
      existingWikis: [],
      modelReview: false,
    });
    const second = await discoverTranscriptWikiTopics({
      transcriptId: fixture.transcript.id,
      canonicalIdeaIds: fixture.canonicalIdeas.map((idea) => idea.id),
      canonicalIdeas: fixture.canonicalIdeas,
      existingWikis: [],
      modelReview: false,
    });
    expect(first.contentHash).toBe(second.contentHash);
  });
});
