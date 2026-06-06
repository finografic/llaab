import { describe, expect, it } from 'vitest';

import { EXTRACTION_MAX_INPUT_TOKENS, prepareExtractionInput } from './harness-prep.js';

describe('prepareExtractionInput', () => {
  it('builds structured control context for extraction', async () => {
    const result = await prepareExtractionInput({
      cwd: process.cwd(),
      input: 'example transcript',
      model: 'llama3:latest',
    });

    expect(result.preparedText).toBe('example transcript');
    expect(result.chunks).toHaveLength(1);
    expect(result.wasChunked).toBe(false);
    expect(result.wasTruncated).toBe(false);
    expect(result.harnessBudgetSteps).toBe(4);
    expect(result.context).toEqual({
      constraints: ['summary must be non-empty', 'output must be valid JSON'],
      data: {
        chunkCount: 1,
        estimatedInputTokens: 5,
        model: 'llama3:latest',
      },
      instructions: 'Return structured extracted knowledge as JSON.',
    });
    expect(result.stages.map((stage) => stage.name)).toEqual([
      'harness:count-extraction-tokens',
      'harness:chunk-if-needed',
      'harness:build-extraction-context',
      'harness:validate-budget',
    ]);
  });

  it('chunks long input instead of truncating it', async () => {
    const result = await prepareExtractionInput({
      cwd: process.cwd(),
      input: 'x'.repeat(EXTRACTION_MAX_INPUT_TOKENS * 4 + 50),
      model: 'llama3:latest',
    });

    expect(result.wasTruncated).toBe(false);
    expect(result.wasChunked).toBe(true);
    expect(result.chunks.length).toBeGreaterThan(1);
    expect(result.preparedText).not.toContain('[transcript truncated for extraction]');
    expect(result.chunks.every((chunk) => chunk.estimatedTokens <= result.maxInputTokens)).toBe(true);
    expect(result.stages[1]?.output).toEqual({
      chunkCount: result.chunks.length,
      chunked: true,
      maxChunkTokens: result.maxInputTokens,
    });
  });
});
