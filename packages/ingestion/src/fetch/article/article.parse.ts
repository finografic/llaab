/**
 * Deterministic HTML → readable article parsing.
 *
 * No LLM is involved in cleaning HTML or resolving metadata. Precedence rules are explicit and
 * tested so that the same document always yields the same stored node.
 */

import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import type { ArticleFetchFailure, FetchedArticle } from './article.contract.js';

import { articleFetchFailure } from './article.contract.js';
import { ARTICLE_MAX_MARKDOWN_CHARS, ARTICLE_MIN_TEXT_CHARS } from './article.limits.js';
import {
  articleHtmlToMarkdown,
  countMeaningfulChars,
  hashArticleText,
  normalizePlainText,
  truncateAtBoundary,
} from './article.markdown.js';
import { normalizeCanonicalUrl } from './article.url.js';

export interface ParseArticleInput {
  html: string;
  requestedUrl: string;
  finalUrl: string;
}

export type ParseArticleResult = ({ ok: true } & FetchedArticle) | ArticleFetchFailure;

/**
 * Linkedom's document type. This package targets Node and deliberately does not enable the DOM lib,
 * so the parser types against what linkedom actually returns rather than browser globals.
 */
type LinkedomDocument = ReturnType<typeof parseHTML>['document'];

/** Builds a DOM whose base URI is the final response URL so relative references resolve correctly. */
function buildDocument(html: string, finalUrl: string): LinkedomDocument {
  const { document } = parseHTML(html);

  // Readability resolves relative URIs against `document.baseURI` / `documentURI`. linkedom cannot
  // derive either from a response, so both must be supplied or every relative link is stored broken.
  Object.defineProperty(document, 'baseURI', { value: finalUrl, configurable: true });
  Object.defineProperty(document, 'documentURI', { value: finalUrl, configurable: true });

  return document;
}

function metaContent(document: LinkedomDocument, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const value = document.querySelector(selector)?.getAttribute('content')?.trim();
    if (value) return value;
  }
  return undefined;
}

function cleanText(value: string | null | undefined): string | undefined {
  const trimmed = value?.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Canonical identity. A canonical link is only trusted when it is absolute and points at the same
 * host as the response — a cross-host canonical is a syndication or SEO artefact, not our identity.
 */
export function resolveCanonicalUrl(document: LinkedomDocument, finalUrl: string): string {
  const declared =
    document.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim() ||
    metaContent(document, ['meta[property="og:url"]']);

  if (declared) {
    try {
      const candidate = new URL(declared, finalUrl);
      const final = new URL(finalUrl);
      if (
        (candidate.protocol === 'http:' || candidate.protocol === 'https:') &&
        candidate.hostname.toLowerCase() === final.hostname.toLowerCase()
      ) {
        return normalizeCanonicalUrl(candidate.toString());
      }
    } catch {
      // Fall through to the response URL.
    }
  }

  return normalizeCanonicalUrl(finalUrl);
}

/** Normalizes a declared publication date to an ISO 8601 UTC string, or drops it if unparseable. */
export function normalizePublishedAt(raw: string | undefined): string | undefined {
  if (!raw) return undefined;

  const trimmed = raw.trim();
  // A bare calendar date is midnight UTC, not midnight in the runner's local zone.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T00:00:00Z` : trimmed;

  const parsed = new Date(dateOnly);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function resolveTitle(
  document: LinkedomDocument,
  readabilityTitle: string | undefined,
  finalUrl: string,
): string {
  const candidates = [
    cleanText(readabilityTitle),
    metaContent(document, ['meta[property="og:title"]', 'meta[name="twitter:title"]']),
    cleanText(document.querySelector('title')?.textContent),
    cleanText(document.querySelector('h1')?.textContent),
  ];

  for (const candidate of candidates) {
    if (candidate) return candidate;
  }

  try {
    return new URL(finalUrl).hostname;
  } catch {
    return 'Untitled article';
  }
}

function resolveSiteName(
  document: LinkedomDocument,
  readabilitySiteName: string | undefined,
  finalUrl: string,
): string | undefined {
  const declared =
    cleanText(readabilitySiteName) ??
    metaContent(document, ['meta[property="og:site_name"]', 'meta[name="application-name"]']);

  if (declared) return declared;

  try {
    return new URL(finalUrl).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

/**
 * Parses one HTML document into a {@link FetchedArticle}.
 *
 * Metadata precedence is Readability → Open Graph / article metadata → standard HTML metadata →
 * safe hostname fallbacks, applied per field rather than per source.
 */
export function parseArticle(input: ParseArticleInput): ParseArticleResult {
  const { html, requestedUrl, finalUrl } = input;
  const failureContext = { requestedUrl, finalUrl };

  let document: LinkedomDocument;
  try {
    document = buildDocument(html, finalUrl);
  } catch {
    return articleFetchFailure('not_readable', 'The response could not be parsed as HTML.', failureContext);
  }

  const article = new Readability(document as never, { charThreshold: ARTICLE_MIN_TEXT_CHARS }).parse();

  if (!article?.content) {
    return articleFetchFailure(
      'not_readable',
      'No readable article content was found on the page.',
      failureContext,
    );
  }

  const plainTextFull = normalizePlainText(article.textContent ?? '');
  if (countMeaningfulChars(plainTextFull) < ARTICLE_MIN_TEXT_CHARS) {
    return articleFetchFailure(
      'not_readable',
      `Extracted article text is shorter than the ${ARTICLE_MIN_TEXT_CHARS}-character minimum.`,
      failureContext,
    );
  }

  const markdownResult = truncateAtBoundary(
    articleHtmlToMarkdown(article.content),
    ARTICLE_MAX_MARKDOWN_CHARS,
  );
  const plainTextResult = truncateAtBoundary(plainTextFull, ARTICLE_MAX_MARKDOWN_CHARS);
  const truncated = markdownResult.truncated || plainTextResult.truncated;

  const publishedAt = normalizePublishedAt(
    cleanText(article.publishedTime) ??
      metaContent(document, [
        'meta[property="article:published_time"]',
        'meta[property="og:published_time"]',
        'meta[name="article:published_time"]',
        'meta[name="date"]',
        'meta[itemprop="datePublished"]',
      ]) ??
      cleanText(document.querySelector('time[datetime]')?.getAttribute('datetime')),
  );

  const language =
    cleanText(document.documentElement?.getAttribute('lang')) ??
    cleanText(article.lang) ??
    metaContent(document, ['meta[property="og:locale"]', 'meta[http-equiv="content-language"]']);

  const byline =
    cleanText(article.byline)?.replace(/^by\s+/i, '') ??
    metaContent(document, [
      'meta[name="author"]',
      'meta[property="article:author"]',
      'meta[name="twitter:creator"]',
    ]);

  const excerpt =
    cleanText(article.excerpt) ??
    metaContent(document, ['meta[property="og:description"]', 'meta[name="description"]']);

  const siteName = resolveSiteName(document, article.siteName ?? undefined, finalUrl);

  return {
    ok: true,
    requestedUrl,
    finalUrl,
    canonicalUrl: resolveCanonicalUrl(document, finalUrl),
    title: resolveTitle(document, article.title ?? undefined, finalUrl),
    ...(byline ? { byline } : {}),
    ...(siteName ? { siteName } : {}),
    ...(excerpt ? { excerpt } : {}),
    ...(publishedAt ? { publishedAt } : {}),
    ...(language ? { language } : {}),
    markdown: markdownResult.text,
    plainText: plainTextResult.text,
    contentHash: hashArticleText(plainTextResult.text),
    truncated,
  };
}
