import { describe, expect, it } from 'vitest';

import { resolveTranscriptSpans, timestampToSeconds, youtubeTimestampUrl } from './wiki-evidence.utils.js';

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

  it('assigns stable paragraph locators when a timestamp is unavailable', () => {
    expect(resolveTranscriptSpans('First paragraph.\n\nSecond paragraph.')).toEqual([
      { locator: 'p:1', text: 'First paragraph.' },
      { locator: 'p:2', text: 'Second paragraph.' },
    ]);
  });

  it('preserves timestamp locators for timestamped paragraphs', () => {
    expect(resolveTranscriptSpans('<!-- t:0:42 -->\n\nTimestamped paragraph.')).toEqual([
      { locator: '0:42', text: 'Timestamped paragraph.' },
    ]);
  });
});
