import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveLlmRoute, routeLlm } = vi.hoisted(() => ({
  resolveLlmRoute: vi.fn(() => ({ provider: 'opencode', model: 'glm-5.2' })),
  routeLlm: vi.fn(),
}));

vi.mock('@llaab/llm', () => ({
  resolveLlmRoute,
  routeLlm,
}));

function consolidationOutput(candidateIds: string[]) {
  return {
    canonicalIdeas: candidateIds.map((candidateId, index) => ({
      title: `Canonical idea ${index + 1}`,
      body: `Canonical body ${index + 1}.`,
      tags: [`topic-${index + 1}`],
      domains: ['d:llm'],
      confidence: 'high',
      sourceCandidateIdeaIds: [candidateId],
      keyClaims: [`Claim ${index + 1}`],
      coverageNotes: `Covers candidate ${index + 1}.`,
    })),
    coverage: {
      coveredCandidateIdeaIds: candidateIds,
      omittedCandidateIdeaIds: [],
      missedCandidateIdeaIds: [],
    },
    possibleMissedIdeas: [],
  };
}

describe('consolidateTranscriptIdeasForTranscript', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'llaab-vault-transcripts-'));
    process.env.LLAAB_VAULT = join(root, 'vault');
    process.env.LLAAB_KNOWLEDGE = join(root, 'knowledge');
    resolveLlmRoute.mockReset();
    resolveLlmRoute.mockReturnValue({ provider: 'opencode', model: 'glm-5.2' });
    routeLlm.mockReset();
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.LLAAB_VAULT;
    delete process.env.LLAAB_KNOWLEDGE;
    await rm(root, { force: true, recursive: true });
  });

  it('retries when the first consolidation transport call rejects', async () => {
    const core = await import('@llaab/core');
    const transcript = await core.createNode({
      type: 'transcript',
      id: 'transport-retry-transcript',
      title: 'Transport retry transcript',
      body: 'A transcript with enough extracted ideas to consolidate.',
      extra: {
        source_url: 'https://www.youtube.com/watch?v=transport-retry',
        source_type: 'youtube',
      },
    });
    const candidateIds: string[] = [];

    for (let index = 1; index <= 4; index++) {
      const candidate = await core.createNode({
        type: 'idea',
        id: `transport-retry-idea-${index}`,
        title: `Transport retry idea ${index}`,
        body: `Candidate body ${index}.`,
        tags: ['d:llm', `topic-${index}`],
        extra: {
          origin: 'extracted',
          llm_model: 'extract-model',
          llm_provider: 'opencode',
        },
      });
      candidateIds.push(candidate.id);
    }

    await core.createNode({
      type: 'run',
      id: 'transport-retry-ingest-run',
      title: 'Transport retry ingest run',
      extra: {
        skill_id: 'ingest-youtube',
        run_status: 'completed',
        produced_node_ids: [transcript.id, ...candidateIds],
      },
    });

    routeLlm
      .mockRejectedValueOnce(new Error('OpenCode request failed: 503 temporarily unavailable'))
      .mockResolvedValueOnce({
        text: JSON.stringify(consolidationOutput(candidateIds)),
        model: 'glm-5.2',
        provider: 'opencode',
        durationMs: 5,
        promptTokens: 10,
        completionTokens: 20,
      });

    const { consolidateTranscriptIdeasForTranscript } = await import('./vault-transcripts.routes.js');
    const result = await consolidateTranscriptIdeasForTranscript({
      transcriptId: transcript.id,
      autoRetry: false,
    });

    expect(routeLlm).toHaveBeenCalledTimes(2);
    expect(result.canonicalIdeaIds).toHaveLength(4);
    await expect(core.readNodeByType('transcript', transcript.id)).resolves.toMatchObject({
      canonical_coverage: {
        canonical_idea_ids: result.canonicalIdeaIds,
        candidate_idea_ids: candidateIds,
        covered_candidate_idea_ids: candidateIds,
      },
    });
  });
});
