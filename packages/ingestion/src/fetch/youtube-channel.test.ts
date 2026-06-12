import { describe, expect, it } from 'vitest';

import { formatAudienceCount } from './youtube-channel.js';

describe('formatAudienceCount', () => {
  it('formats thousands and millions compactly', () => {
    expect(formatAudienceCount(540)).toBe('540');
    expect(formatAudienceCount(540_000)).toBe('540K');
    expect(formatAudienceCount(1_200_000)).toBe('1.2M');
    expect(formatAudienceCount(12_000_000)).toBe('12M');
  });
});
