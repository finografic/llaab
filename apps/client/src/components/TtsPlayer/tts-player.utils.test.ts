import { describe, expect, it } from 'vitest';

import {
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
      "Zero Trust Explained in 5 Minutes Think about what happens when you connect to your company's network. Normal Markdown link text remains.",
    );
  });

  it('keeps the H1 title while skipping metadata and ## Transcript', () => {
    const sections = createTtsSectionsFromText(`# Heading

**author:** Example

## Transcript

First paragraph.

Second paragraph.`);

    expect(sections.map((section) => section.text)).toEqual([
      'Heading',
      'First paragraph.',
      'Second paragraph.',
    ]);
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

  it('splits playback chunks on sentence endings', () => {
    expect(splitTtsSentences('First sentence. Second sentence! Third?')).toEqual([
      'First sentence.',
      'Second sentence!',
      'Third?',
    ]);
  });

  it('keeps wiki section headings and strips section markers plus footnotes', () => {
    const sections = createTtsSectionsFromText(`# Reducing system prompt bloat

<!-- wiki-section:overview -->

## How tool definitions inflate the system prompt

Agent frameworks include every tool definition.[^canonical-ref-1]

<!-- wiki-section:audit -->

## Auditing the real token payload

Use a proxy to inspect tokens.[^canonical-ref-2]`);

    expect(sections.map((section) => section.text)).toEqual([
      'Reducing system prompt bloat',
      'How tool definitions inflate the system prompt',
      'Agent frameworks include every tool definition.',
      'Auditing the real token payload',
      'Use a proxy to inspect tokens.',
    ]);
  });
});
