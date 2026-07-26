import { describe, expect, it } from 'vitest';

import { parseLmStudioProgressLine } from './lmstudio-progress.js';

describe('parseLmStudioProgressLine', () => {
  it('parses loading, prompt-processing, and idle states for the requested model', () => {
    expect(parseLmStudioProgressLine('google/gemma-4-e4b LOADING 42.5%', 'google/gemma-4-e4b')).toEqual({
      status: 'loading',
      completionTokens: undefined,
    });
    expect(
      parseLmStudioProgressLine('google/gemma-4-e4b PROCESSING PROMPT 100%', 'google/gemma-4-e4b'),
    ).toEqual({
      status: 'processing prompt',
      completionTokens: undefined,
    });
    expect(parseLmStudioProgressLine('google/gemma-4-e4b IDLE', 'google/gemma-4-e4b')).toEqual({
      status: 'idle',
      completionTokens: undefined,
    });
  });

  it('parses generation token counts with comma separators', () => {
    expect(parseLmStudioProgressLine('google/gemma-4-e4b GEN 1,234 tok', 'google/gemma-4-e4b')).toEqual({
      status: 'generating',
      completionTokens: 1234,
    });
  });

  it('ignores unrelated models and lines without a supported status', () => {
    expect(parseLmStudioProgressLine('other-model GEN 20 tok', 'google/gemma-4-e4b')).toBeUndefined();
    expect(parseLmStudioProgressLine('google/gemma-4-e4b QUEUED', 'google/gemma-4-e4b')).toBeUndefined();
  });
});
