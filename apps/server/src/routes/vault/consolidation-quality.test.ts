import { describe, expect, it } from 'vitest';

import { validateConsolidationQuality } from './consolidation-quality.js';

const theoCandidates: Array<{
  id: string;
  title: string;
  body?: string;
  domains: string[];
  tags: string[];
}> = [
  {
    id: 'v8-isolates-enable-lightweight-multi-tenant-sandboxing-for-ai-agents-without-docker-overhead',
    title: 'V8 isolates',
    domains: ['d:infra'],
    tags: ['sandboxing'],
  },
  {
    id: 'llm-non-determinism-worsens-as-context-window-size-increases-significantly',
    title: 'Non-determinism worsens with context',
    domains: ['d:llm'],
    tags: [],
  },
  {
    id: 'llm-non-determinism-is-linked-to-excessive-context-token-usage',
    title: 'Non-determinism linked to tokens',
    domains: ['d:llm'],
    tags: [],
  },
  {
    id: 'bash-serves-as-a-crucial-foundational-execution-layer-for-ai-agents-but-has-inherent-limitations',
    title: 'Bash foundational layer',
    domains: ['d:agents'],
    tags: ['bash'],
  },
  {
    id: 'typescript-sdks-replace-bloated-mcp-discovery-reducing-tokens-and-improving-reliability',
    title: 'TypeScript SDKs',
    domains: ['d:agents'],
    tags: ['typescript'],
  },
  {
    id: 'context-retrieval-via-code-generated-search-is-superior-to-context-stuffing-for-llm-performance-and-cost',
    title: 'Targeted retrieval',
    domains: ['d:llm'],
    tags: [],
  },
];

describe('validateConsolidationQuality', () => {
  it('passes a strong five-idea consolidation shape', () => {
    const canonicalIdeas = [
      {
        title: 'Replace context stuffing with targeted retrieval',
        body: 'Use grep and code search instead of dumping full repos.',
        tags: ['d:llm', 'context-management', 'token-efficiency'],
        sourceCandidateIdeaIds: [theoCandidates[5]!.id],
      },
      {
        title: 'Bash is a foundational but limited execution layer',
        body: 'Bash enabled the first agent execution layer but is limited.',
        tags: ['d:agents', 'bash', 'execution-layer'],
        sourceCandidateIdeaIds: [theoCandidates[3]!.id],
      },
      {
        title: 'Typed programmable execution layers replace raw terminal commands',
        body: 'TypeScript SDKs provide safer structured agent tooling.',
        tags: ['d:agents', 'typescript', 'typed-execution'],
        sourceCandidateIdeaIds: [theoCandidates[4]!.id],
      },
      {
        title: 'V8 isolates enable lightweight runtime isolation',
        body: 'Multi-tenant sandboxing without Docker overhead.',
        tags: ['d:infra', 'v8-isolates', 'sandboxing'],
        sourceCandidateIdeaIds: [theoCandidates[0]!.id],
      },
      {
        title: 'Large context windows increase LLM non-determinism',
        body: 'Excessive context harms model behavior and performance.',
        tags: ['d:llm', 'model-behavior', 'non-determinism'],
        sourceCandidateIdeaIds: [theoCandidates[1]!.id, theoCandidates[2]!.id],
      },
    ];

    const covered = canonicalIdeas.flatMap((idea) => idea.sourceCandidateIdeaIds);
    const result = validateConsolidationQuality(theoCandidates, canonicalIdeas, covered);

    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('fails when canonical count is too low and required themes are missing', () => {
    const canonicalIdeas = [
      {
        title: 'Targeted retrieval beats context stuffing',
        body: 'Search instead of dump.',
        tags: ['d:llm', 'context-management'],
        sourceCandidateIdeaIds: [theoCandidates[5]!.id],
      },
      {
        title: 'Bash execution layer',
        body: 'Bash is foundational.',
        tags: ['d:agents', 'bash'],
        sourceCandidateIdeaIds: [theoCandidates[3]!.id],
      },
      {
        title: 'Typed execution environments',
        body: 'TypeScript SDKs help.',
        tags: ['d:agents', 'typescript'],
        sourceCandidateIdeaIds: [theoCandidates[4]!.id],
      },
    ];

    const covered = canonicalIdeas.flatMap((idea) => idea.sourceCandidateIdeaIds);
    const result = validateConsolidationQuality(theoCandidates, canonicalIdeas, covered);

    expect(result.passed).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'canonical_count',
        'candidate_coverage',
        'v8_runtime',
        'non_determinism_separate',
      ]),
    );
  });

  it('fails when non-determinism is folded into the context-retrieval idea', () => {
    const nonDeterminismIds = [theoCandidates[1]!.id, theoCandidates[2]!.id];
    const canonicalIdeas = [
      {
        title: 'Evolution from context stuffing to targeted retrieval',
        body: 'Shifting to targeted retrieval improves performance and minimizes non-determinism.',
        tags: ['d:llm', 'context-management', 'retrieval'],
        keyClaims: ['Massive context stuffing causes performance degradation and non-determinism'],
        sourceCandidateIdeaIds: [
          theoCandidates[5]!.id,
          ...nonDeterminismIds,
          'early-ai-agents-failed-by-dumping-massive-codebases-into-prompts',
        ],
      },
      {
        title: 'Bash is a foundational but limited execution layer',
        body: 'Bash enabled the first agent execution layer but is limited.',
        tags: ['d:agents', 'bash', 'execution-layer'],
        sourceCandidateIdeaIds: [theoCandidates[3]!.id],
      },
      {
        title: 'Typed programmable execution layers replace raw terminal commands',
        body: 'TypeScript SDKs provide safer structured agent tooling.',
        tags: ['d:agents', 'typescript', 'typed-execution'],
        sourceCandidateIdeaIds: [theoCandidates[4]!.id],
      },
      {
        title: 'V8 isolates enable lightweight runtime isolation',
        body: 'Multi-tenant sandboxing without Docker overhead.',
        tags: ['d:infra', 'v8-isolates', 'sandboxing'],
        sourceCandidateIdeaIds: [theoCandidates[0]!.id],
      },
    ];

    const covered = canonicalIdeas.flatMap((idea) => idea.sourceCandidateIdeaIds);
    const result = validateConsolidationQuality(theoCandidates, canonicalIdeas, covered);

    expect(result.passed).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('non_determinism_separate');
  });
});
