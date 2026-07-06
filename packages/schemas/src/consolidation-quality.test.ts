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
    id: 'runtime-isolation-uses-sandboxes-to-contain-agent-execution',
    title: 'Runtime isolation sandboxes agent execution',
    domains: ['d:infra'],
    tags: ['runtime-isolation'],
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
  it('passes a strong five-idea consolidation shape with a high score', () => {
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
        sourceCandidateIdeaIds: [theoCandidates[0]!.id, theoCandidates[1]!.id],
      },
      {
        title: 'Large context windows increase LLM non-determinism',
        body: 'Excessive context harms model behavior and performance.',
        tags: ['d:llm', 'model-behavior', 'non-determinism'],
        sourceCandidateIdeaIds: [theoCandidates[2]!.id, theoCandidates[3]!.id],
      },
    ];

    const covered = canonicalIdeas.flatMap((idea) => idea.sourceCandidateIdeaIds);
    const result = validateConsolidationQuality(theoCandidates, canonicalIdeas, covered);

    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.score).toBeGreaterThanOrEqual(85);
  });

  it('fails when canonical count is too low and required themes are missing', () => {
    const canonicalIdeas = [
      {
        title: 'Targeted retrieval beats context stuffing',
        body: 'Search instead of dump.',
        tags: ['d:llm', 'context-management'],
        sourceCandidateIdeaIds: [theoCandidates[6]!.id],
      },
      {
        title: 'Bash execution layer',
        body: 'Bash is foundational.',
        tags: ['d:agents', 'bash'],
        sourceCandidateIdeaIds: [theoCandidates[4]!.id],
      },
      {
        title: 'Typed execution environments',
        body: 'TypeScript SDKs help.',
        tags: ['d:agents', 'typescript'],
        sourceCandidateIdeaIds: [theoCandidates[5]!.id],
      },
    ];

    const covered = canonicalIdeas.flatMap((idea) => idea.sourceCandidateIdeaIds);
    const result = validateConsolidationQuality(theoCandidates, canonicalIdeas, covered);

    expect(result.passed).toBe(false);
    expect(result.score).toBeLessThan(85);
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
    const nonDeterminismIds = [theoCandidates[2]!.id, theoCandidates[3]!.id];
    const canonicalIdeas = [
      {
        title: 'Evolution from context stuffing to targeted retrieval',
        body: 'Shifting to targeted retrieval improves performance and minimizes non-determinism.',
        tags: ['d:llm', 'context-management', 'retrieval'],
        keyClaims: ['Massive context stuffing causes performance degradation and non-determinism'],
        sourceCandidateIdeaIds: [
          theoCandidates[6]!.id,
          ...nonDeterminismIds,
          'early-ai-agents-failed-by-dumping-massive-codebases-into-prompts',
        ],
      },
      {
        title: 'Bash is a foundational but limited execution layer',
        body: 'Bash enabled the first agent execution layer but is limited.',
        tags: ['d:agents', 'bash', 'execution-layer'],
        sourceCandidateIdeaIds: [theoCandidates[4]!.id],
      },
      {
        title: 'Typed programmable execution layers replace raw terminal commands',
        body: 'TypeScript SDKs provide safer structured agent tooling.',
        tags: ['d:agents', 'typescript', 'typed-execution'],
        sourceCandidateIdeaIds: [theoCandidates[5]!.id],
      },
      {
        title: 'V8 isolates enable lightweight runtime isolation',
        body: 'Multi-tenant sandboxing without Docker overhead.',
        tags: ['d:infra', 'v8-isolates', 'sandboxing'],
        sourceCandidateIdeaIds: [theoCandidates[0]!.id, theoCandidates[1]!.id],
      },
    ];

    const covered = canonicalIdeas.flatMap((idea) => idea.sourceCandidateIdeaIds);
    const result = validateConsolidationQuality(theoCandidates, canonicalIdeas, covered);

    expect(result.passed).toBe(false);
    expect(result.score).toBeLessThan(100);
    expect(result.issues.map((issue) => issue.code)).toContain('non_determinism_separate');
  });

  it('does not fail a good consolidation for a single incidental typed-execution candidate', () => {
    const candidates = [
      {
        id: 'known-problems-are-better-agent-benchmarks',
        title: 'Known problems are better agent benchmarks',
        domains: ['d:llm'],
        tags: ['benchmarking'],
      },
      {
        id: 'living-instruction-files-preserve-agent-guidance',
        title: 'Living instruction files preserve agent guidance',
        domains: ['d:automation'],
        tags: ['agent-guidance'],
      },
      {
        id: 'targeted-retrieval-avoids-context-stuffing',
        title: 'Targeted retrieval avoids context stuffing',
        domains: ['d:llm'],
        tags: ['context-management'],
      },
      {
        id: 'local-environment-integrity-prevents-agent-confusion',
        title: 'Local environment integrity prevents agent confusion',
        domains: ['d:infra'],
        tags: ['dev-environment'],
      },
      {
        id: 'typescript-sdk-detail-appears-as-a-single-side-note',
        title: 'TypeScript SDK detail appears as a single side note',
        domains: ['d:automation'],
        tags: ['typescript'],
      },
    ];
    const canonicalIdeas = [
      {
        title: 'Known problems make better AI benchmarks',
        body: 'Familiar tasks make model output easier to judge.',
        tags: ['d:llm', 'benchmarking'],
        sourceCandidateIdeaIds: [candidates[0]!.id],
      },
      {
        title: 'Living instruction files steer agent behavior',
        body: 'Durable instructions capture recurring guidance.',
        tags: ['d:automation', 'agent-guidance'],
        sourceCandidateIdeaIds: [candidates[1]!.id],
      },
      {
        title: 'Targeted retrieval beats context stuffing',
        body: 'Search-driven context keeps prompts focused.',
        tags: ['d:llm', 'context-management'],
        sourceCandidateIdeaIds: [candidates[2]!.id],
      },
      {
        title: 'Environment integrity is prerequisite for agent success',
        body: 'Broken local setups confuse agent debugging.',
        tags: ['d:infra', 'dev-environment'],
        sourceCandidateIdeaIds: [candidates[3]!.id, candidates[4]!.id],
      },
    ];

    const covered = canonicalIdeas.flatMap((idea) => idea.sourceCandidateIdeaIds);
    const result = validateConsolidationQuality(candidates, canonicalIdeas, covered);

    expect(result.passed).toBe(true);
    expect(result.issues.map((issue) => issue.code)).not.toContain('typed_execution');
  });
});
