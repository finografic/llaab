import { describe, expect, it } from 'vitest';

import {
  applyTtsFullStopChar,
  createTtsSectionsFromText,
  normalizeTtsText,
  splitTtsSentences,
  stripTtsMetadataLines,
} from './tts-player.utils';

describe('TTS player text normalization', () => {
  it('strips transcript metadata while preserving transcript content', () => {
    const text = `# Zero Trust Explained in 5 Minutes

[**https://youtu.be/q2phcnesXvY?si=tdUW68S_V7m0vXw-**](https://youtu.be/q2phcnesXvY?si=tdUW68S_V7m0vXw-)
**author:** [**kodekloud**](https://www.youtube.com/@KodeKloud)
**uploaded:** 2026-07-17 14:07:07
**ingested:** 2026-07-18 07:19:01

## Transcript

<-- t:0:00 -->
Think about what happens when you connect to your company's network.

Normal [Markdown link](https://example.com/path) text remains.`;

    expect(normalizeTtsText(stripTtsMetadataLines(text))).toBe(
      "Think about what happens when you connect to your company's network. Normal Markdown link text remains.",
    );
  });

  it('creates sections from transcript body after metadata removal', () => {
    const sections = createTtsSectionsFromText(`# Heading

**author:** Example

## Transcript

First paragraph.

Second paragraph.`);

    expect(sections.map((section) => section.text)).toEqual(['First paragraph.', 'Second paragraph.']);
  });

  it('creates one section per blank-line paragraph', () => {
    const sections = createTtsSectionsFromText(`## Transcript

First paragraph. Still first.

Second paragraph.`);

    expect(sections.map((section) => section.text)).toEqual([
      'First paragraph. Still first.',
      'Second paragraph.',
    ]);
  });

  it('rewrites sentence-final periods for prosody after sentence split', () => {
    const sentences = splitTtsSentences('First sentence. Second sentence! Third?');
    expect(sentences).toEqual(['First sentence.', 'Second sentence!', 'Third?']);
    expect(sentences.map((sentence) => applyTtsFullStopChar(sentence, ','))).toEqual([
      'First sentence,',
      'Second sentence!',
      'Third?',
    ]);
  });

  it('leaves text unchanged when fullStopChar is omitted', () => {
    expect(applyTtsFullStopChar('Keep the period.', undefined)).toBe('Keep the period.');
  });
});
