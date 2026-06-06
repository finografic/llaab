import { describe, expect, it } from 'vitest';

import { autoTag } from './taxonomy.js';

describe('autoTag', () => {
  it('detects LLM model family and open-weight content from body text', () => {
    expect(
      autoTag(
        'Master Gemma 4 in 20 Minutes',
        'Gemma 4 is an open-weight model with edge inference and a long context window.',
      ),
    ).toContain('d:llm');
  });

  it('detects orchestration roadmap terms conservatively', () => {
    expect(autoTag('Typed command bus', 'The harness dispatches through an adapter executor.')).toContain(
      'd:automation',
    );
  });
});
