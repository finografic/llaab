import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const vaultRoutes = join(import.meta.dirname);

describe('one-step wiki production path', () => {
  it('keeps greedy grouping out of transcript creation orchestration', () => {
    const generation = readFileSync(join(vaultRoutes, 'wiki-draft-generation.service.ts'), 'utf8');
    const oneStep = readFileSync(join(vaultRoutes, 'wiki-one-step.service.ts'), 'utf8');

    expect(generation).toMatch(/discoverTranscriptWikiTopics/);
    expect(generation).toMatch(/executeTranscriptWikiCompile/);
    expect(generation).not.toMatch(/groupCanonicalIdeasForWikiDrafts/);
    expect(oneStep).toMatch(/executeTranscriptWikiCompile/);
    expect(oneStep).not.toMatch(/groupCanonicalIdeas/);
  });

  it('never auto-promotes needs-review by inventing a suffixed topic key', async () => {
    const { evaluateWikiAutoPromotionPolicy } = await import('@llaab/schemas');
    const blocked = evaluateWikiAutoPromotionPolicy({
      operation: 'needs-review',
      verificationStatus: 'source-backed',
      qualityScore: 95,
      coherencePassed: true,
      evidenceGatesPassed: true,
      hasValidLinks: true,
      hasValidSourceRefs: true,
      inventedSuffixedTopicKey: true,
    });
    expect(blocked.allow).toBe(false);
    expect(blocked.outcome).not.toBe('promoted-create');
  });
});
