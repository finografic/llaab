import { describe, expect, it } from 'vitest';

import {
  articleHtmlToMarkdown,
  countMeaningfulChars,
  hashArticleText,
  normalizeMarkdown,
  normalizePlainText,
  truncateAtBoundary,
} from './article.markdown.js';

describe('articleHtmlToMarkdown', () => {
  it('uses ATX headings, dash bullets, and fenced code', () => {
    const markdown = articleHtmlToMarkdown(
      '<h2>Heading</h2><ul><li>one</li></ul><pre><code>const a = 1;</code></pre>',
    );

    expect(markdown).toContain('## Heading');
    expect(markdown).toContain('-   one');
    expect(markdown).toContain('```');
  });

  it('removes elements that carry behaviour rather than meaning', () => {
    const markdown = articleHtmlToMarkdown(
      '<p>Kept.</p><script>track()</script><style>.a{}</style><form><input /></form><iframe src="x"></iframe>',
    );

    expect(markdown).toBe('Kept.');
  });
});

describe('normalizeMarkdown', () => {
  it('collapses blank-line runs, trailing whitespace, and non-breaking spaces', () => {
    expect(normalizeMarkdown('a   \n\n\n\n b c \n')).toBe('a\n\n b c');
  });

  it('normalizes CRLF so line endings cannot change the hash', () => {
    expect(normalizeMarkdown('a\r\n\r\nb')).toBe(normalizeMarkdown('a\n\nb'));
  });
});

describe('normalizePlainText', () => {
  it('preserves paragraph breaks and collapses everything else', () => {
    expect(normalizePlainText('First   line\nstill first.\n\n\nSecond.')).toBe(
      'First line still first.\n\nSecond.',
    );
  });

  it('drops empty paragraphs', () => {
    expect(normalizePlainText('\n\n  \n\nOnly.\n\n   \n')).toBe('Only.');
  });
});

describe('countMeaningfulChars', () => {
  it('counts non-whitespace characters only', () => {
    expect(countMeaningfulChars('  a b\n c  ')).toBe(3);
  });
});

describe('truncateAtBoundary', () => {
  it('leaves text at or under the limit untouched', () => {
    expect(truncateAtBoundary('abcdef', 6)).toEqual({ text: 'abcdef', truncated: false });
  });

  it('prefers a nearby paragraph break', () => {
    const text = `${'a'.repeat(92)}\n\n${'b'.repeat(30)}`;
    const result = truncateAtBoundary(text, 100);

    expect(result.truncated).toBe(true);
    expect(result.text).toBe('a'.repeat(92));
  });

  it('falls back to a line break when no paragraph break is near the cut', () => {
    const text = `${'a'.repeat(95)}\n${'b'.repeat(30)}`;
    const result = truncateAtBoundary(text, 100);

    expect(result.truncated).toBe(true);
    expect(result.text).toBe('a'.repeat(95));
  });

  it('hard-cuts when no boundary sits within the final tenth', () => {
    const result = truncateAtBoundary('a'.repeat(200), 100);

    expect(result.truncated).toBe(true);
    expect(result.text).toHaveLength(100);
  });
});

describe('hashArticleText', () => {
  it('is a stable sha256 hex digest', () => {
    expect(hashArticleText('hello')).toMatch(/^[\da-f]{64}$/);
    expect(hashArticleText('hello')).toBe(hashArticleText('hello'));
  });

  it('ignores cosmetic whitespace differences so dedupe is not whitespace-sensitive', () => {
    expect(hashArticleText('one   two\nthree')).toBe(hashArticleText('one two three'));
  });

  it('differs for different content', () => {
    expect(hashArticleText('one')).not.toBe(hashArticleText('two'));
  });
});
