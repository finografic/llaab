import { CanonicalIdeaNodeSchema, TranscriptNodeSchema } from '@llaab/schemas';
import { describe, expect, it } from 'vitest';

import {
  buildWikiEvidence,
  resolveTranscriptSpans,
  timestampToSeconds,
  youtubeTimestampUrl,
  WIKI_EVIDENCE_MAX_ITEMS,
} from './wiki-evidence.utils.js';

function transcript(body: string, sourceUrl = 'https://www.youtube.com/watch?v=test') {
  return TranscriptNodeSchema.parse({
    id: 'test-transcript',
    type: 'transcript',
    title: 'Test transcript',
    body,
    tags: [],
    related: [],
    status: 'seed',
    created_at: '2026-07-13T00:00:00Z',
    source_url: sourceUrl,
    source_type: 'youtube',
    author: 'Test Author',
  });
}

function canonical(id = 'test-idea') {
  return CanonicalIdeaNodeSchema.parse({
    id,
    type: 'canonical-idea',
    title: 'Targeted retrieval',
    body: 'Targeted retrieval keeps context focused.',
    tags: [],
    related: [],
    status: 'seed',
    created_at: '2026-07-13T00:00:00Z',
    transcript_id: 'test-transcript',
    source_candidate_idea_ids: ['candidate-idea'],
    key_claims: ['Retrieval reduces irrelevant context.'],
  });
}

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

  it('ranks relevant spans, excludes unrelated text, and preserves lineage', () => {
    const evidence = buildWikiEvidence(
      transcript(
        '<!-- t:0:10 -->\n\nCooking pasta requires salted water.\n\n<!-- t:0:42 -->\n\nTargeted retrieval keeps agent context focused.',
      ),
      [canonical()],
    );

    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({
      canonical_idea_id: 'test-idea',
      canonical_idea_ids: ['test-idea'],
      transcript_id: 'test-transcript',
      locator: '0:42',
      author: 'Test Author',
    });
    expect(evidence[0]?.excerpt).not.toContain('pasta');
    expect(evidence[0]?.source_url).toContain('t=42');
  });

  it('falls back to transcript-level provenance when a timestamp cannot deep-link', () => {
    const evidence = buildWikiEvidence(
      transcript('<!-- t:0:42 -->\n\nTargeted retrieval keeps context focused.', 'https://example.com/video'),
      [canonical()],
    );

    expect(evidence[0]?.locator).toBeUndefined();
    expect(evidence[0]?.source_url).toBe('https://example.com/video');
  });

  it('deduplicates overlapping spans and enforces the item budget', () => {
    const ideas = Array.from({ length: WIKI_EVIDENCE_MAX_ITEMS + 5 }, (_, index) =>
      canonical(`test-idea-${index + 1}`),
    );
    const evidence = buildWikiEvidence(transcript('Targeted retrieval keeps context focused.'), ideas);

    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.canonical_idea_ids).toHaveLength(ideas.length);
    expect(evidence.length).toBeLessThanOrEqual(WIKI_EVIDENCE_MAX_ITEMS);
  });
});
