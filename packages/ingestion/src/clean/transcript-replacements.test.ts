import { describe, expect, it } from 'vitest';

import { applyKnownTranscriptReplacements } from './transcript-replacements.js';

describe('applyKnownTranscriptReplacements', () => {
  it('replaces Verscell with Vercel (case-insensitive, word boundaries)', () => {
    expect(applyKnownTranscriptReplacements('CEO of Verscell said hi')).toBe('CEO of Vercel said hi');
    expect(applyKnownTranscriptReplacements('verscell deploy')).toBe('Vercel deploy');
  });

  it('leaves unrelated text unchanged', () => {
    expect(applyKnownTranscriptReplacements('clean transcript')).toBe('clean transcript');
  });
});
