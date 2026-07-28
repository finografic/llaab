/**
 * Deterministic Markdown and plain-text normalization for fetched articles.
 *
 * Determinism is a persistence requirement, not a style preference: `contentHash` is derived from
 * normalized plain text and drives article deduplication, so the same bytes must always normalize to
 * the same output.
 */

import { createHash } from 'node:crypto';
import TurndownService from 'turndown';

import { ARTICLE_MAX_MARKDOWN_CHARS } from './article.limits.js';

function createTurndown(): TurndownService {
  const service = new TurndownService({
    headingStyle: 'atx',
    // Turndown defaults to `*`; the vault writes `-` everywhere else.
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '_',
    strongDelimiter: '**',
    hr: '---',
    linkStyle: 'inlined',
  });

  // Nothing that carries behaviour rather than meaning survives into a stored document.
  service.remove(['script', 'style', 'noscript', 'iframe', 'form', 'button', 'svg']);

  return service;
}

const turndown = createTurndown();

/** Converts article HTML to Markdown and applies whitespace normalization. */
export function articleHtmlToMarkdown(articleHtml: string): string {
  return normalizeMarkdown(turndown.turndown(articleHtml));
}

/**
 * Collapses trailing whitespace and runs of blank lines so that cosmetic differences in the source
 * HTML cannot produce different stored Markdown.
 */
export function normalizeMarkdown(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ /g, ' ')
    .trim();
}

/**
 * Collapses an article's text content into normalized plain text: paragraph breaks are preserved,
 * every other whitespace run becomes a single space.
 */
export function normalizePlainText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter((paragraph) => paragraph.length > 0)
    .join('\n\n')
    .trim();
}

/** Non-whitespace character count, used against the readable-article floor. */
export function countMeaningfulChars(text: string): number {
  return text.replace(/\s/g, '').length;
}

export interface TruncationResult {
  text: string;
  truncated: boolean;
}

/**
 * Caps text at `limit` characters, preferring the last paragraph break and then the last line break
 * within the final 10% so a cut never lands mid-sentence when a clean boundary is nearby.
 */
export function truncateAtBoundary(
  text: string,
  limit: number = ARTICLE_MAX_MARKDOWN_CHARS,
): TruncationResult {
  if (text.length <= limit) return { text, truncated: false };

  const hardCut = text.slice(0, limit);
  const searchFloor = Math.floor(limit * 0.9);

  const paragraphBreak = hardCut.lastIndexOf('\n\n');
  if (paragraphBreak >= searchFloor) {
    return { text: hardCut.slice(0, paragraphBreak).trimEnd(), truncated: true };
  }

  const lineBreak = hardCut.lastIndexOf('\n');
  if (lineBreak >= searchFloor) {
    return { text: hardCut.slice(0, lineBreak).trimEnd(), truncated: true };
  }

  return { text: hardCut.trimEnd(), truncated: true };
}

/** SHA-256 of normalized plain text. Never hash raw HTML — it carries per-request noise. */
export function hashArticleText(plainText: string): string {
  return createHash('sha256').update(normalizePlainText(plainText), 'utf8').digest('hex');
}
