import { describe, expect, it } from 'vitest';

import {
  createWikiFixtureCanonicalIdea,
  createWikiFixtureTranscript,
} from '../../../schemas/src/wiki.fixtures.js';
import { buildWikiEvidence, parseTranscriptParagraphs } from './wiki-evidence.utils.js';

describe('wiki evidence expansion', () => {
  it('preserves timestamp markers and ranks relevant transcript paragraphs', () => {
    const transcript = createWikiFixtureTranscript({
      body: [
        '<!-- t:0:10 -->',
        '',
        'Unrelated discussion about gardening and soil.',
        '',
        '<!-- t:1:20 -->',
        '',
        'Targeted retrieval keeps agent context focused and reduces irrelevant tokens.',
      ].join('\n'),
    });
    const idea = createWikiFixtureCanonicalIdea();

    const evidence = buildWikiEvidence(transcript, [idea]);

    expect(parseTranscriptParagraphs(transcript.body)).toHaveLength(2);
    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({ locator: '1:20', canonical_idea_id: idea.id });
    expect(evidence[0]?.excerpt).toContain('Targeted retrieval');
  });

  it('falls back to transcript-level evidence when no paragraph matches', () => {
    const transcript = createWikiFixtureTranscript({
      body: '<!-- t:0:10 -->\n\nGardening only.',
      summary: 'Transcript-level fallback summary.',
    });
    const idea = createWikiFixtureCanonicalIdea();

    const evidence = buildWikiEvidence(transcript, [idea]);

    expect(evidence[0]).toMatchObject({
      excerpt: 'Transcript-level fallback summary.',
      confidence: 'medium',
    });
    expect(evidence[0]?.locator).toBeUndefined();
  });
});
