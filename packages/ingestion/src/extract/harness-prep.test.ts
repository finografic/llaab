import { describe, expect, it } from 'vitest';

import { EXTRACTION_INPUT_CHAR_LIMIT, prepareExtractionInput } from './harness-prep.js';

describe('prepareExtractionInput', () => {
  it('builds structured control context for extraction', async () => {
    const result = await prepareExtractionInput({
      cwd: process.cwd(),
      input: 'example transcript',
    });

    expect(result.preparedText).toBe('example transcript');
    expect(result.wasTruncated).toBe(false);
    expect(result.harnessBudgetSteps).toBe(2);
    expect(result.context).toEqual({
      constraints: ['summary must be non-empty', 'output must be valid JSON'],
      data: 'example transcript',
      instructions: 'Return structured extracted knowledge as JSON.',
    });
    expect(result.stages.map((stage) => stage.name)).toEqual([
      'harness:truncate-extraction-input',
      'harness:build-extraction-context',
    ]);
  });

  it('truncates long input and records that fact in the harness stage output', async () => {
    const result = await prepareExtractionInput({
      cwd: process.cwd(),
      input: 'x'.repeat(EXTRACTION_INPUT_CHAR_LIMIT + 50),
    });

    expect(result.wasTruncated).toBe(true);
    expect(result.preparedText).toContain('[transcript truncated for extraction]');
    expect(result.stages[0]?.output).toEqual({
      preparedLength: result.preparedText.length,
      truncated: true,
    });
  });
});
