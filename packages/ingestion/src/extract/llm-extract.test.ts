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

  it('returns structured ideas, skills, and summary from valid JSON response', async () => {
    vi.mocked(routeLlm).mockResolvedValue({ text: VALID_RESPONSE, model: 'llama3.1:8b', cached: false });

    const result = await llmExtract('example transcript');

    expect(result.ideas).toHaveLength(2);
    expect(result.skills).toContain('prompt engineering');
    expect(result.summary).toBe('Overview of LLM training and prompting strategies.');
  });

  it('strips markdown fences before parsing JSON', async () => {
    const fenced = '```json\n' + VALID_RESPONSE + '\n```';
    vi.mocked(routeLlm).mockResolvedValue({ text: fenced, model: 'llama3.1:8b', cached: false });

    const result = await llmExtract('example transcript');

    expect(result.ideas).toHaveLength(2);
  });

  it('rejects when LLM returns malformed JSON with no retries remaining', async () => {
    vi.mocked(routeLlm).mockResolvedValue({ text: 'not json at all', model: 'llama3.1:8b', cached: false });

    await expect(llmExtract('example transcript')).rejects.toThrow();
  });

  it('rejects when JSON is valid but summary is empty', async () => {
    const badSummary = JSON.stringify({ ideas: ['idea'], skills: [], summary: '' });
    vi.mocked(routeLlm).mockResolvedValue({ text: badSummary, model: 'llama3.1:8b', cached: false });

    await expect(llmExtract('example transcript')).rejects.toThrow();
  });

  it('returns control trace metadata with accept decision on success', async () => {
    vi.mocked(routeLlm).mockResolvedValue({ text: VALID_RESPONSE, model: 'llama3.1:8b', cached: false });

    const result = await llmExtractWithTrace('example transcript');

    expect(result.runTrace.stages.map((stage) => stage.name)).toEqual([
      'harness:truncate-extraction-input',
      'harness:build-extraction-context',
      'control:extract-knowledge',
    ]);
    expect(result.runTrace.decisions.at(-1)?.type).toBe('accept');
    expect(result.runTrace.llm?.model).toBe('ollama');
  });

  it('truncates long inputs before calling the model', async () => {
    vi.mocked(routeLlm).mockResolvedValue({ text: VALID_RESPONSE, model: 'llama3.1:8b', cached: false });

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
