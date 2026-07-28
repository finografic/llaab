import { describe, expect, it } from 'vitest';

import { readArticleFixture } from './__fixtures__/index.js';
import { normalizePublishedAt, parseArticle } from './article.parse.js';

function parse(fixture: Parameters<typeof readArticleFixture>[0], finalUrl: string, requestedUrl = finalUrl) {
  return parseArticle({ html: readArticleFixture(fixture), requestedUrl, finalUrl });
}

describe('parseArticle — semantic markup', () => {
  const result = parse('semanticArticle', 'https://signal.example.com/posts/bounded-fetching');

  it('succeeds', () => {
    expect(result.ok).toBe(true);
  });

  it('prefers Readability metadata, falling back through OG and standard HTML', () => {
    if (!result.ok) throw new Error('expected success');

    expect(result.title).toContain('Bounded Fetching for Knowledge Systems');
    expect(result.byline).toBe('Dana Okonkwo');
    expect(result.siteName).toBe('Signal Journal');
    expect(result.language).toBe('en-GB');
    expect(result.publishedAt).toBe('2026-05-14T09:30:00.000Z');
    expect(result.excerpt).toBeTruthy();
  });

  it('strips the "By" prefix from a byline', () => {
    if (!result.ok) throw new Error('expected success');
    expect(result.byline).not.toMatch(/^by\s/i);
  });

  it('uses the declared canonical URL as durable identity', () => {
    if (!result.ok) throw new Error('expected success');
    expect(result.canonicalUrl).toBe('https://signal.example.com/posts/bounded-fetching');
  });

  it('produces Markdown without page furniture or raw HTML', () => {
    if (!result.ok) throw new Error('expected success');

    expect(result.markdown).toContain('## Why redirects deserve their own budget');
    expect(result.markdown).toContain('-   Resolve immediately before connecting.');
    expect(result.markdown).not.toContain('<p>');
    expect(result.markdown).not.toContain('© 2026 Signal Journal');
  });

  it('reports untruncated content and a stable hash of the plain text', () => {
    if (!result.ok) throw new Error('expected success');

    expect(result.truncated).toBe(false);
    expect(result.contentHash).toMatch(/^[\da-f]{64}$/);

    const again = parse('semanticArticle', 'https://signal.example.com/posts/bounded-fetching');
    if (!again.ok) throw new Error('expected success');
    expect(again.contentHash).toBe(result.contentHash);
  });

  it('retains the requested URL alongside the final URL', () => {
    const redirected = parse(
      'semanticArticle',
      'https://signal.example.com/posts/bounded-fetching',
      'https://sho.rt/abc?utm_source=news',
    );
    if (!redirected.ok) throw new Error('expected success');

    expect(redirected.requestedUrl).toBe('https://sho.rt/abc?utm_source=news');
    expect(redirected.finalUrl).toBe('https://signal.example.com/posts/bounded-fetching');
  });
});

describe('parseArticle — Open Graph-only metadata', () => {
  const result = parse('openGraphOnly', 'https://meridian.example.org/essays/unbounded-reader');

  it('falls back to Open Graph for title, site, author, and date', () => {
    if (!result.ok) throw new Error('expected success');

    expect(result.title).toBe('The Cost of an Unbounded Reader');
    expect(result.siteName).toBe('Meridian Review');
    expect(result.byline).toBe('Priya Raghunathan');
    expect(result.publishedAt).toBe('2026-03-02T00:00:00.000Z');
  });

  it('strips tracking parameters from an og:url canonical', () => {
    if (!result.ok) throw new Error('expected success');
    expect(result.canonicalUrl).toBe('https://meridian.example.org/essays/unbounded-reader');
  });
});

describe('parseArticle — canonical URL trust', () => {
  it('ignores a cross-host canonical and keeps the response URL', () => {
    const html = `<!doctype html><html><head><title>Syndicated</title>
      <link rel="canonical" href="https://original-publisher.example.net/the-piece" /></head>
      <body><article><h1>Syndicated</h1><p>${'This paragraph exists so the document clears the readable-article floor. '.repeat(6)}</p></article></body></html>`;

    const result = parseArticle({
      html,
      requestedUrl: 'https://aggregator.example.com/copy',
      finalUrl: 'https://aggregator.example.com/copy',
    });

    if (!result.ok) throw new Error('expected success');
    expect(result.canonicalUrl).toBe('https://aggregator.example.com/copy');
  });
});

describe('parseArticle — relative references', () => {
  it('resolves every relative reference against the final URL', () => {
    const result = parse('relativeLinks', 'https://notes.example.net/blog/linking-notes');
    if (!result.ok) throw new Error('expected success');

    expect(result.markdown).toContain('https://notes.example.net/reference/ids');
    expect(result.markdown).toContain('https://notes.example.net/glossary');
    expect(result.markdown).toContain('https://cdn.example.net/img/graph.png');
    expect(result.markdown).not.toMatch(/\]\(\.\.\//);
  });
});

describe('parseArticle — noisy pages', () => {
  it('drops navigation, banners, forms, and scripts', () => {
    const result = parse('noisyNavigation', 'https://ledger.example.com/2026/07/page-furniture/');
    if (!result.ok) throw new Error('expected success');

    expect(result.plainText).toContain('Most of a modern article page is not the article');
    expect(result.markdown).not.toContain('Accept all cookies');
    expect(result.markdown).not.toContain('should-never-be-stored');
    expect(result.markdown).not.toMatch(/<script|<style|<form/i);
  });

  it('recovers deterministically from tag soup', () => {
    const first = parse('malformed', 'https://soup.example.com/a');
    const second = parse('malformed', 'https://soup.example.com/a');

    if (!first.ok || !second.ok) throw new Error('expected success');
    expect(first.plainText).toContain('Tag soup is the normal condition');
    expect(first.contentHash).toBe(second.contentHash);
  });
});

describe('parseArticle — unreadable pages', () => {
  it('fails with not_readable for a client-rendered shell', () => {
    const result = parse('noReadableArticle', 'https://spa.example.com/');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('not_readable');
    expect(result.finalUrl).toBe('https://spa.example.com/');
  });

  it('fails with not_readable when an unterminated title swallows the body', () => {
    const result = parse('unterminatedTitle', 'https://rcdata.example.com/a');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('not_readable');
  });

  it('fails with not_readable for prose under the 200-character floor', () => {
    const html =
      '<!doctype html><html><head><title>Stub</title></head><body><article><p>Too short.</p></article></body></html>';
    const result = parseArticle({
      html,
      requestedUrl: 'https://stub.example.com/a',
      finalUrl: 'https://stub.example.com/a',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('not_readable');
  });
});

describe('normalizePublishedAt', () => {
  it('treats a bare calendar date as midnight UTC', () => {
    expect(normalizePublishedAt('2026-03-02')).toBe('2026-03-02T00:00:00.000Z');
  });

  it('normalizes offset timestamps to UTC', () => {
    expect(normalizePublishedAt('2026-05-14T11:30:00+02:00')).toBe('2026-05-14T09:30:00.000Z');
  });

  it('drops values it cannot parse', () => {
    expect(normalizePublishedAt('last Tuesday')).toBeUndefined();
    expect(normalizePublishedAt(undefined)).toBeUndefined();
    expect(normalizePublishedAt('')).toBeUndefined();
  });
});
