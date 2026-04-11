import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@llaab/llm', () => ({
  summarizeText: vi.fn(),
}));

import { summarizeText } from '@llaab/llm';

import { llmExtract, llmExtractWithTrace } from './llm-extract.js';

describe('llmExtract', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects empty summaries through control validation', async () => {
    vi.mocked(summarizeText).mockResolvedValue('');

    await expect(llmExtract('example transcript')).rejects.toThrow();
  });

  it('returns control trace metadata alongside structured extraction output', async () => {
    vi.mocked(summarizeText).mockResolvedValue('usable summary');

    const result = await llmExtractWithTrace('example transcript');

    expect(result.summary).toBe('usable summary');
    expect(result.runTrace.decisions.at(-1)?.type).toBe('accept');
    expect(result.runTrace.llm?.model).toBe('ollama');
  });
});
