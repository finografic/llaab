import { execute } from '@llaab/control';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

describe('control.execute', () => {
  it('retries invalid output until schema-valid data is produced', async () => {
    let attempts = 0;

    const result = await execute({
      task: 'extract-summary',
      input: { text: 'hello world' },
      schema: z.object({
        summary: z.string().min(1),
      }),
      policy: {
        maxRetries: 2,
        onInvalid: 'retry',
        onFailure: 'reject',
      },
      run: async () => {
        attempts += 1;

        if (attempts === 1) {
          return { summary: '' };
        }

        return { summary: 'usable summary' };
      },
    });

    expect(attempts).toBe(2);
    expect(result.data.summary).toBe('usable summary');
    expect(result.decisions.map((decision) => decision.type)).toEqual(['retry', 'accept']);
  });
});
