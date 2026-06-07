import { describe, expect, it } from 'vitest';

import {
  extractMetadataUrl,
  formatMetadataJson,
  parseMetadataJson,
  splitMetadataTextWithUrls,
} from './metadata-rendering.utils.js';

describe('parseMetadataJson', () => {
  it('parses clean JSON strings', () => {
    expect(parseMetadataJson('{"url":"https://example.com","tags":[]}')).toEqual({
      url: 'https://example.com',
      tags: [],
    });
  });

  it('parses YAML double-encoded strings with literal backslash quotes', () => {
    expect(
      parseMetadataJson(String.raw`{\"url\":\"https://www.youtube.com/watch?v=pzUn9wTCgcw\",\"tags\":[]}`),
    ).toEqual({
      url: 'https://www.youtube.com/watch?v=pzUn9wTCgcw',
      tags: [],
    });
  });
});

describe('formatMetadataJson', () => {
  it('returns readable JSON without escaped quote artifacts', () => {
    expect(formatMetadataJson(String.raw`{\"url\":\"https://example.com\"}`)).toBe(
      '{"url":"https://example.com"}',
    );
  });
});

describe('extractMetadataUrl', () => {
  it('returns the url field when present', () => {
    expect(extractMetadataUrl(String.raw`{\"url\":\"https://example.com/watch?v=abc\"}`)).toBe(
      'https://example.com/watch?v=abc',
    );
  });
});

describe('splitMetadataTextWithUrls', () => {
  it('splits text around URLs', () => {
    expect(splitMetadataTextWithUrls('see https://example.com now')).toEqual([
      { type: 'text', value: 'see ', start: 0 },
      { type: 'url', value: 'https://example.com', start: 4 },
      { type: 'text', value: ' now', start: 23 },
    ]);
  });
});
