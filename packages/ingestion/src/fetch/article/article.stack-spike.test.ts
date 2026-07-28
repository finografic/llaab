/**
 * Phase 0 dependency spike.
 *
 * Confirms `linkedom` + `@mozilla/readability` + `turndown` handle every parsing fixture before the
 * Phase 1 implementation commits to the stack. These assertions describe the capability the parser
 * will rely on — they are deliberately about the libraries, not about LLAAB's own parse module.
 */

import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import TurndownService from 'turndown';
import { describe, expect, it } from 'vitest';
import type { ArticleFixtureName } from './__fixtures__/index.js';

import { readArticleFixture } from './__fixtures__/index.js';

function parseFixture(name: ArticleFixtureName, documentUrl: string) {
  const html = readArticleFixture(name);
  const { document } = parseHTML(html);

  // Readability reads `document.baseURI` / `documentURI` to resolve relative references; linkedom
  // does not derive them from a response, so the caller must supply the final URL.
  Object.defineProperty(document, 'baseURI', { value: documentUrl, configurable: true });
  Object.defineProperty(document, 'documentURI', { value: documentUrl, configurable: true });

  return { document, article: new Readability(document as never).parse() };
}

/** `textContent` preserves source line breaks, so prose assertions compare collapsed whitespace. */
function collapse(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

describe('linkedom + readability + turndown stack', () => {
  it('extracts the article body and metadata from semantic markup', () => {
    const { article } = parseFixture('semanticArticle', 'https://signal.example.com/posts/bounded-fetching');

    expect(article?.title).toContain('Bounded Fetching for Knowledge Systems');
    expect(article?.byline).toContain('Dana Okonkwo');
    expect(collapse(article?.textContent)).toContain('belongs to a single owning module');
    expect(collapse(article?.textContent)).not.toContain('© 2026 Signal Journal');
    expect(article?.lang).toBe('en-GB');
  });

  it('produces Markdown with headings, lists, quotes, and inline code preserved', () => {
    const { article } = parseFixture('semanticArticle', 'https://signal.example.com/posts/bounded-fetching');
    const markdown = turndown.turndown(article?.content ?? '');

    expect(markdown).toContain('## Why redirects deserve their own budget');
    expect(markdown).toContain('-   Resolve immediately before connecting.');
    expect(markdown).toContain('> Treat the network as adversarial');
    expect(markdown).toContain('`Content-Length`');
    expect(markdown).not.toContain('<p>');
  });

  it('recovers prose from a page whose only metadata is Open Graph', () => {
    const { document, article } = parseFixture(
      'openGraphOnly',
      'https://meridian.example.org/essays/unbounded-reader',
    );

    expect(collapse(article?.textContent)).toContain('denial-of-service vector you built yourself');
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(
      'The Cost of an Unbounded Reader',
    );
    expect(document.querySelector('meta[property="og:site_name"]')?.getAttribute('content')).toBe(
      'Meridian Review',
    );
    expect(document.querySelector('meta[property="article:published_time"]')?.getAttribute('content')).toBe(
      '2026-03-02',
    );
  });

  it('resolves relative, root-relative, and protocol-relative references', () => {
    const { article } = parseFixture('relativeLinks', 'https://notes.example.net/blog/linking-notes');
    const markdown = turndown.turndown(article?.content ?? '');

    expect(markdown).toContain('https://notes.example.net/reference/ids');
    expect(markdown).toContain('https://notes.example.net/glossary');
    expect(markdown).toContain('https://notes.example.net/blog/deeper/nested-note');
    expect(markdown).toContain('https://cdn.example.net/img/graph.png');
    expect(markdown).not.toMatch(/\]\(\.\.\//);
  });

  it('drops navigation, consent banners, forms, scripts, and styles', () => {
    const { article } = parseFixture('noisyNavigation', 'https://ledger.example.com/2026/07/page-furniture/');
    const text = collapse(article?.textContent);

    expect(text).toContain('Most of a modern article page is not the article');
    expect(text).not.toContain('Accept all cookies');
    expect(text).not.toContain('Subscribe now');
    expect(text).not.toContain('should-never-be-stored');
    expect(article?.content ?? '').not.toMatch(/<script|<style|<form/i);
  });

  it('recovers deterministically from malformed markup', () => {
    const first = parseFixture('malformed', 'https://soup.example.com/a');
    const second = parseFixture('malformed', 'https://soup.example.com/a');

    expect(collapse(first.article?.textContent)).toContain('Tag soup is the normal condition');
    expect(first.article?.textContent).toBe(second.article?.textContent);
  });

  it('yields effectively no text for a client-rendered shell', () => {
    const { article } = parseFixture('noReadableArticle', 'https://spa.example.com/');
    const text = (article?.textContent ?? '').replace(/\s+/g, '');

    expect(text.length).toBeLessThan(200);
  });

  it('yields an empty body for an unterminated title, as the HTML spec requires', () => {
    // RCDATA swallows the rest of the document. jsdom behaves identically, so this is a genuine
    // `not_readable` case rather than a parser deficiency to work around.
    const { document, article } = parseFixture('unterminatedTitle', 'https://rcdata.example.com/a');

    expect(document.body?.textContent?.trim()).toBe('');
    expect(article).toBeNull();
  });

  it('reads canonical identity from the terminal document of a redirect chain', () => {
    const { document } = parseFixture(
      'redirectTarget',
      'https://final.example.com/articles/after-three-hops',
    );

    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://final.example.com/articles/after-three-hops',
    );
  });
});
