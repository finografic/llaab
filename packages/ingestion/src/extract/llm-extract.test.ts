import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@llaab/llm', () => ({
  summarizeText: vi.fn(),
}));

import { summarizeText } from '@llaab/llm';

import { llmExtract } from './llm-extract.js';

describe('llmExtract', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects empty summaries through control validation', async () => {
    vi.mocked(summarizeText).mockResolvedValue('');

    await expect(llmExtract('example transcript')).rejects.toThrow();
  });
});
