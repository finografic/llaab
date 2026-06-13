import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@llaab/llm', () => ({
  invalidateLlmCache: vi.fn(),
  resolveLlmRoute: vi.fn(() => ({
    model: 'llama3.1:8b',
    provider: 'ollama',
    tier: 'local-mid',
  })),
  ollamaGetModelContextLength: vi.fn(() => Promise.resolve(undefined)),
  routeLlm: vi.fn(),
}));

import { routeLlm } from '@llaab/llm';

import { llmExtract, llmExtractWithTrace } from './llm-extract.js';

const VALID_RESPONSE = JSON.stringify({
  ideas: [
    {
      title: 'LLMs require careful prompt engineering',
      domain_tags: ['d:llm'],
      topic_tags: ['Prompt Engineering'],
    },
    {
      title: 'Fine-tuning outperforms prompting for narrow tasks',
      domain_tags: ['d:llm'],
      topic_tags: ['fine tuning'],
    },
  ],
  skills: ['prompt engineering', 'fine-tuning'],
  summary: 'Overview of LLM training and prompting strategies.',
  tags: ['Prompt Engineering', 'fine tuning', 'RLHF'],
});

// Legacy format: ideas with "tags" instead of "topic_tags" — accepted as a fallback
const LEGACY_RESPONSE = JSON.stringify({
  ideas: [
    {
      title: 'LLMs require careful prompt engineering',
      domain_tags: ['d:llm'],
      tags: ['prompt-engineering'],
    },
  ],
  skills: ['prompt engineering'],
  summary: 'Overview of LLM prompting strategies.',
  tags: ['prompt-engineering'],
});

describe('llmExtract', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  function mockRouteLlm(text: string): void {
    vi.mocked(routeLlm).mockResolvedValue({
      text,
      model: 'llama3.1:8b',
      cached: false,
      provider: 'ollama',
      durationMs: 150,
    });
  }

  it('returns structured ideas, skills, and summary from valid JSON response', async () => {
    mockRouteLlm(VALID_RESPONSE);

    const result = await llmExtract('example transcript');

    expect(result.ideas).toHaveLength(2);
    expect(result.skills).toContain('prompt engineering');
    expect(result.summary).toBe('Overview of LLM training and prompting strategies.');
    expect(result.tags).toEqual(['prompt-engineering', 'fine-tuning', 'rlhf']);
  });

  it('strips markdown fences before parsing JSON', async () => {
    const fenced = '```json\n' + VALID_RESPONSE + '\n```';
    mockRouteLlm(fenced);

    const result = await llmExtract('example transcript');

    expect(result.ideas).toHaveLength(2);
  });

  it('rejects when LLM returns malformed JSON with no retries remaining', async () => {
    mockRouteLlm('not json at all');

    await expect(llmExtract('example transcript')).rejects.toThrow();
  });

  it('rejects when JSON is valid but summary is empty', async () => {
    const badSummary = JSON.stringify({
      ideas: [{ title: 'idea', domain_tags: [], topic_tags: [] }],
      skills: [],
      summary: '',
    });
    mockRouteLlm(badSummary);

    await expect(llmExtract('example transcript')).rejects.toThrow();
  });

  it('rejects when root-level tags are omitted', async () => {
    mockRouteLlm(
      JSON.stringify({
        ideas: [
          {
            title: 'LLMs require careful prompt engineering',
            domain_tags: ['d:llm'],
            topic_tags: ['prompt-engineering'],
          },
        ],
        skills: ['prompt engineering'],
        summary: 'Overview of LLM prompting strategies.',
        // no root-level "tags" field
      }),
    );

    await expect(llmExtract('example transcript')).rejects.toThrow();
  });

  it('accepts legacy idea "tags" field as fallback for "topic_tags"', async () => {
    mockRouteLlm(LEGACY_RESPONSE);

    const result = await llmExtract('example transcript');

    expect(result.ideas[0]?.tags).toEqual(['prompt-engineering']);
  });

  it('returns control trace metadata with accept decision on success', async () => {
    mockRouteLlm(VALID_RESPONSE);

    const result = await llmExtractWithTrace('example transcript');

    expect(result.runTrace.stages.map((stage) => stage.name)).toEqual([
      'harness:count-extraction-tokens',
      'harness:chunk-if-needed',
      'harness:build-extraction-context',
      'harness:validate-budget',
      'control:extract-knowledge',
    ]);
    expect(result.runTrace.decisions.at(-1)?.type).toBe('accept');
    expect(result.runTrace.llm?.model).toBe('llama3.1:8b');
    expect(result.runTrace.llm?.provider).toBe('ollama');
    expect(result.runTrace.llm?.duration_ms).toBe(150);
    expect(result.llmMeta).toEqual({
      model: 'llama3.1:8b',
      provider: 'ollama',
      durationMs: 150,
      promptTokens: undefined,
      completionTokens: undefined,
    });
  });

  it('chunks long inputs before calling the model and reduces duplicate output', async () => {
    mockRouteLlm(VALID_RESPONSE);

    const result = await llmExtractWithTrace('x'.repeat(40_000));

    expect(routeLlm).toHaveBeenCalledTimes(2);
    expect(vi.mocked(routeLlm).mock.calls[0]?.[1]).toContain('[chunk 1/2]');
    expect(vi.mocked(routeLlm).mock.calls[0]?.[1]).not.toContain('[transcript truncated for extraction]');
    expect(result.ideas).toHaveLength(2);
    expect(result.skills).toHaveLength(2);
    expect(result.runTrace.stages.at(-1)?.output).toEqual({
      ideas: [
        {
          title: 'LLMs require careful prompt engineering',
          domainTags: ['d:llm'],
          tags: ['prompt-engineering'],
        },
        {
          title: 'Fine-tuning outperforms prompting for narrow tasks',
          domainTags: ['d:llm'],
          tags: ['fine-tuning'],
        },
      ],
      skills: ['prompt engineering', 'fine-tuning'],
      summary: 'Overview of LLM training and prompting strategies.',
      tags: ['prompt-engineering', 'fine-tuning', 'rlhf'],
    });
    expect(routeLlm).toHaveBeenLastCalledWith(
      'extract',
      expect.stringContaining('[chunk 2/2]'),
      expect.objectContaining({
        bypassCache: true,
        model: 'llama3.1:8b',
        system: expect.any(String),
      }),
    );
  });
});
