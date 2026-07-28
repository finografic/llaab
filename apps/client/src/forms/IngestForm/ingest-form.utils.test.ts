import { describe, expect, it } from 'vitest';

import {
  classifyUrl,
  contentNoun,
  ingestButtonLabel,
  isIngestibleSourceKind,
  producesTranscript,
  sourceKindLabel,
  stepLabel,
  transcriptStepTitle,
} from './ingest-form.utils';

describe('classifyUrl', () => {
  it('classifies YouTube URLs', () => {
    expect(classifyUrl('https://www.youtube.com/watch?v=abc')).toBe('youtube');
    expect(classifyUrl('https://youtu.be/abc')).toBe('youtube');
  });

  it('classifies Pocket Casts URLs', () => {
    expect(classifyUrl('https://pca.st/episode/abc')).toBe('podcast');
  });

  it('classifies any other http(s) URL as a web page', () => {
    expect(classifyUrl('https://claude.com/blog/some-post')).toBe('webpage');
    expect(classifyUrl('http://example.com/a')).toBe('webpage');
  });

  it('classifies anything unparseable as unknown', () => {
    expect(classifyUrl('not a url')).toBe('unknown');
    expect(classifyUrl('')).toBe('unknown');
    expect(classifyUrl('ftp://example.com/a')).toBe('unknown');
  });
});

describe('isIngestibleSourceKind', () => {
  it('now accepts web pages alongside youtube and podcast', () => {
    expect(isIngestibleSourceKind('youtube')).toBe(true);
    expect(isIngestibleSourceKind('podcast')).toBe(true);
    expect(isIngestibleSourceKind('webpage')).toBe(true);
  });

  it('still rejects an unclassified URL', () => {
    expect(isIngestibleSourceKind('unknown')).toBe(false);
  });
});

describe('producesTranscript', () => {
  it('is true only for the transcript-producing kinds', () => {
    expect(producesTranscript('youtube')).toBe(true);
    expect(producesTranscript('podcast')).toBe(true);
    expect(producesTranscript('webpage')).toBe(false);
  });
});

describe('contentNoun', () => {
  it('calls a web page an article and everything else a transcript', () => {
    expect(contentNoun('webpage')).toBe('Article');
    expect(contentNoun('youtube')).toBe('Transcript');
    expect(contentNoun('podcast')).toBe('Transcript');
  });
});

describe('ingestButtonLabel', () => {
  it('names the detected source kind', () => {
    expect(ingestButtonLabel('youtube')).toBe('Ingest YouTube');
    expect(ingestButtonLabel('podcast')).toBe('Ingest Podcast');
    expect(ingestButtonLabel('webpage')).toBe('Ingest Article');
    expect(ingestButtonLabel('unknown')).toBe('Ingest');
  });
});

describe('sourceKindLabel', () => {
  it('no longer claims web pages are unsupported', () => {
    const label = sourceKindLabel('webpage');

    expect(label).toBe('Article or web page detected.');
    expect(label).not.toMatch(/not yet wired|not wired/i);
  });
});

describe('stepLabel', () => {
  it('defaults to transcript wording', () => {
    expect(stepLabel('processing', 'idle')).toBe('Fetching transcript…');
    expect(stepLabel('saved', 'idle')).toBe('Transcript saved');
    expect(stepLabel('failed', 'idle')).toBe('Transcript fetch failed');
  });

  it('uses the supplied noun for articles', () => {
    expect(stepLabel('processing', 'idle', 'Article')).toBe('Fetching article…');
    expect(stepLabel('saved', 'idle', 'Article')).toBe('Article saved');
    expect(stepLabel('reused', 'idle', 'Article')).toBe('Article already saved');
    expect(stepLabel('failed', 'idle', 'Article')).toBe('Article fetch failed');
  });

  it('keeps extraction wording source-neutral', () => {
    expect(stepLabel('saved', 'pending', 'Article')).toBe('Extracting ideas…');
    expect(stepLabel('saved', 'success', 'Article')).toBe('Complete');
  });
});

describe('transcriptStepTitle', () => {
  it('swaps the noun without changing phase semantics', () => {
    expect(transcriptStepTitle('saved')).toBe('Transcript saved');
    expect(transcriptStepTitle('saved', 'Article')).toBe('Article saved');
    expect(transcriptStepTitle('processing', 'Article')).toBe('Article processing');
    expect(transcriptStepTitle('idle', 'Article')).toBe('Article pending');
  });
});
