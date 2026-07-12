import { describe, expect, it } from 'vitest';

import { timestampToSeconds, youtubeTimestampUrl } from './wiki-evidence.utils.js';

describe('wiki evidence timestamp resolution', () => {
  it('creates a validated YouTube deep link', () => {
    expect(timestampToSeconds('1:02:03')).toBe(3723);
    expect(youtubeTimestampUrl('https://www.youtube.com/watch?v=test', '1:02:03')).toBe(
      'https://www.youtube.com/watch?v=test&t=3723',
    );
  });

  it('preserves transcript-level provenance for invalid locator or non-YouTube URL', () => {
    expect(timestampToSeconds('1:99')).toBeUndefined();
    expect(youtubeTimestampUrl('https://example.com/video', '0:42')).toBeUndefined();
  });
});
