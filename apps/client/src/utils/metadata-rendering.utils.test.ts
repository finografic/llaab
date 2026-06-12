import { describe, expect, it } from 'vitest';

import {
  extractMetadataUrl,
  extractRunAuthor,
  extractRunSourceId,
  extractRunSubjectHref,
  extractRunSubjectTitle,
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

  it('parses summaries with repeated escaped quote layers', () => {
    expect(parseMetadataJson(String.raw`{\\\\\\\"url\\\\\\\":\\\\\\\"https://example.com\\\\\\\"}`)).toEqual({
      url: 'https://example.com',
    });
  });
});

describe('formatMetadataJson', () => {
  it('returns readable JSON without escaped quote artifacts', () => {
    expect(formatMetadataJson(String.raw`{\"url\":\"https://example.com\"}`)).toBe(
      '{"url":"https://example.com"}',
    );
  });

  it('pretty-prints readable JSON when indentation is requested', () => {
    expect(formatMetadataJson(String.raw`{\\\\\\\"url\\\\\\\":\\\\\\\"https://example.com\\\\\\\"}`, 2)).toBe(
      '{\n  "url": "https://example.com"\n}',
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

describe('extractRunSubjectTitle', () => {
  it('prefers completed stage output titles', () => {
    expect(
      extractRunSubjectTitle({
        stages: [
          {
            status: 'completed',
            output: { title: 'Jira and Linear are legacy software' },
          },
        ],
      }),
    ).toBe('Jira and Linear are legacy software');
  });
});

describe('extractRunSubjectHref', () => {
  it('links transcript outputs to vault transcript routes', () => {
    expect(
      extractRunSubjectHref({
        output_summary: '{"id":"jira-and-linear-are-legacy-software","type":"transcript"}',
      }),
    ).toBe('/vault/transcripts/jira-and-linear-are-legacy-software');
  });

  it('falls back to store:transcript stage output ids', () => {
    expect(
      extractRunSubjectHref({
        stages: [
          {
            name: 'store:transcript',
            status: 'completed',
            output: { id: 'jira-and-linear-are-legacy-software' },
          },
        ],
      }),
    ).toBe('/vault/transcripts/jira-and-linear-are-legacy-software');
  });
});

describe('extractRunAuthor', () => {
  it('reads channel names from completed fetch stages', () => {
    expect(
      extractRunAuthor({
        stages: [
          {
            name: 'fetch:youtube',
            status: 'completed',
            output: { channel: 'Theo - t3․gg' },
          },
        ],
      }),
    ).toBe('Theo - t3․gg');
  });
});

describe('extractRunSourceId', () => {
  it('reads source ids from completed store:source stages', () => {
    expect(
      extractRunSourceId({
        stages: [
          {
            name: 'store:source',
            status: 'completed',
            output: { id: 'theo-t3-gg' },
          },
        ],
      }),
    ).toBe('theo-t3-gg');
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
