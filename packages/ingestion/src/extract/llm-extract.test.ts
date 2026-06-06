import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@llaab/llm', () => ({
  routeLlm: vi.fn(),
}));

import { routeLlm } from '@llaab/llm';

import { llmExtract, llmExtractWithTrace } from './llm-extract.js';

const VALID_RESPONSE = JSON.stringify({
  ideas: ['LLMs require careful prompt engineering', 'Fine-tuning outperforms prompting for narrow tasks'],
  skills: ['prompt engineering', 'fine-tuning'],
  summary: 'Overview of LLM training and prompting strategies.',
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
    const badSummary = JSON.stringify({ ideas: ['idea'], skills: [], summary: '' });
    mockRouteLlm(badSummary);

    await expect(llmExtract('example transcript')).rejects.toThrow();
  });

  it('returns control trace metadata with accept decision on success', async () => {
    mockRouteLlm(VALID_RESPONSE);

    const result = await llmExtractWithTrace('example transcript');

    expect(result.runTrace.stages.map((stage) => stage.name)).toEqual([
      'harness:truncate-extraction-input',
      'harness:build-extraction-context',
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

  it('truncates long inputs before calling the model', async () => {
    mockRouteLlm(VALID_RESPONSE);

    await llmExtractWithTrace('x'.repeat(6_500));

    expect(routeLlm).toHaveBeenCalledWith(
      'extract',
      expect.stringContaining('[transcript truncated for extraction]'),
      expect.objectContaining({
        system: expect.any(String),
      }),
    );
  });
});
