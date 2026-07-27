import { describe, expect, it } from 'vitest';

import { chunkMarkdown, formatPassageForContext } from './chunk-markdown.utils.js';

describe('chunkMarkdown', () => {
  it('splits on blank lines and records heading breadcrumbs', () => {
    const passages = chunkMarkdown(
      ['# Title', '', '## Section A', '', 'First paragraph body.', '', 'Second paragraph body.'].join('\n'),
      { minCharacters: 0 },
    );

    expect(passages.map((passage) => passage.text)).toEqual([
      'First paragraph body.',
      'Second paragraph body.',
    ]);
    expect(passages[0]?.heading_path).toEqual(['Title', 'Section A']);
  });

  it('resets the breadcrumb when a heading closes a deeper section', () => {
    const passages = chunkMarkdown(
      ['# Doc', '', '## One', '', 'Alpha content.', '', '## Two', '', 'Beta content.'].join('\n'),
      { minCharacters: 0 },
    );

    expect(passages[0]?.heading_path).toEqual(['Doc', 'One']);
    expect(passages[1]?.heading_path).toEqual(['Doc', 'Two']);
  });

  it('attaches transcript timestamps and strips the markers from text', () => {
    const passages = chunkMarkdown(
      ['<!-- t:0:00 -->', 'Opening remarks.', '', '<!-- t:1:46 -->', 'The useful part.'].join('\n'),
      { minCharacters: 0 },
    );

    expect(passages).toHaveLength(2);
    expect(passages[0]).toMatchObject({ text: 'Opening remarks.', timestamp: '0:00' });
    expect(passages[1]).toMatchObject({ text: 'The useful part.', timestamp: '1:46' });
    expect(passages.every((passage) => !passage.text.includes('<!--'))).toBe(true);
  });

  it('merges short adjacent blocks in the same section', () => {
    const passages = chunkMarkdown(['Short one.', '', 'Short two.'].join('\n'), {
      minCharacters: 100,
    });

    expect(passages).toHaveLength(1);
    expect(passages[0]?.text).toBe('Short one.\n\nShort two.');
  });

  it('does not merge across a timestamp boundary', () => {
    const passages = chunkMarkdown(
      ['<!-- t:0:00 -->', 'Short one.', '', '<!-- t:0:30 -->', 'Short two.'].join('\n'),
      { minCharacters: 100 },
    );

    expect(passages).toHaveLength(2);
  });

  it('splits an oversized block on sentence boundaries with overlap', () => {
    const sentence = 'This sentence is padded out to a reasonable length for chunking. ';
    const passages = chunkMarkdown(sentence.repeat(12), {
      maxCharacters: 200,
      overlapCharacters: 40,
    });

    expect(passages.length).toBeGreaterThan(1);
    expect(passages.every((passage) => passage.text.length <= 260)).toBe(true);
    // Overlap means the tail of one passage reappears at the head of the next.
    expect(passages[1]?.text.startsWith('This sentence')).toBe(true);
  });

  it('keeps fenced code blocks intact', () => {
    const passages = chunkMarkdown(
      ['Intro line.', '', '```ts', 'const a = 1;', '', 'const b = 2;', '```', '', 'Outro line.'].join('\n'),
      { minCharacters: 0 },
    );

    const fenced = passages.find((passage) => passage.text.includes('```'));
    expect(fenced?.text).toContain('const a = 1;');
    expect(fenced?.text).toContain('const b = 2;');
  });

  it('returns nothing for an empty body', () => {
    expect(chunkMarkdown('')).toEqual([]);
    expect(chunkMarkdown('   \n\n  ')).toEqual([]);
  });

  it('numbers passages in document order', () => {
    const passages = chunkMarkdown(['One.', '', 'Two.', '', 'Three.'].join('\n'), {
      minCharacters: 0,
    });
    expect(passages.map((passage) => passage.index)).toEqual([0, 1, 2]);
  });
});

describe('formatPassageForContext', () => {
  it('prefixes the heading breadcrumb and timestamp', () => {
    const [passage] = chunkMarkdown(['# Doc', '', '## Part', '', '<!-- t:2:10 -->', 'Body.'].join('\n'), {
      minCharacters: 0,
    });

    expect(formatPassageForContext(passage!)).toBe('Doc › Part\n[2:10] Body.');
  });

  it('omits the breadcrumb when the document has no headings', () => {
    const [passage] = chunkMarkdown('Body only.', { minCharacters: 0 });
    expect(formatPassageForContext(passage!)).toBe('Body only.');
  });
});
