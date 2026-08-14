import { parseFrontmatter } from '@llaab/core';
import type { FetchedArticle } from '../fetch/article/index.js';

import {
  hashArticleText,
  normalizeMarkdown,
  normalizePlainText,
  truncateAtBoundary,
} from '../fetch/article/article.markdown.js';
import { validateArticleUrl } from '../fetch/article/article.url.js';

export interface ParsedObsidianWebClip {
  article: FetchedArticle;
  tags: string[];
}

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (!Array.isArray(value)) return undefined;
  const first = value.find((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return first?.trim();
}

function stringList(value: unknown): string[] {
  if (typeof value === 'string') return [value.trim()].filter(Boolean);
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanObsidianLink(value: string): string {
  return value.replace(/^\[\[(.*)\]\]$/, '$1').trim();
}

function firstMarkdownHeading(markdown: string): string | undefined {
  const heading = markdown.match(/^#{1,3}\s+(.+)$/m)?.[1]?.trim();
  return heading ? heading.replace(/^#+\s*/, '') : undefined;
}

function normalizePublishedAt(value: unknown): string | undefined {
  const text = firstString(value);
  if (!text) return undefined;

  const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T00:00:00.000Z`) : new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function hostnameFor(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

export function parseObsidianWebClip(markdown: string): ParsedObsidianWebClip {
  const parsed = parseFrontmatter(markdown);
  const source = firstString(parsed.frontmatter.source);

  if (!source) {
    throw new Error('Obsidian Web Clip is missing a source URL.');
  }

  const validation = validateArticleUrl(source);
  if (!validation.ok) {
    throw new Error(`Obsidian Web Clip source is not supported: ${validation.message}`);
  }

  const normalizedMarkdown = normalizeMarkdown(parsed.body);
  if (!normalizedMarkdown) {
    throw new Error('Obsidian Web Clip is missing article content.');
  }

  const plainText = normalizePlainText(normalizedMarkdown);
  if (!plainText) {
    throw new Error('Obsidian Web Clip article content is empty.');
  }

  const truncated = truncateAtBoundary(normalizedMarkdown);
  const canonicalUrl = validation.url.toString();
  const title =
    firstString(parsed.frontmatter.title) ?? firstMarkdownHeading(normalizedMarkdown) ?? canonicalUrl;
  const authors = stringList(parsed.frontmatter.author).map(cleanObsidianLink);
  const description = firstString(parsed.frontmatter.description);
  const publishedAt = normalizePublishedAt(parsed.frontmatter.published);
  const siteName = hostnameFor(canonicalUrl);

  return {
    article: {
      requestedUrl: source,
      finalUrl: canonicalUrl,
      canonicalUrl,
      title,
      ...(authors.length > 0 ? { byline: authors.join(', ') } : {}),
      ...(description ? { excerpt: description } : {}),
      ...(siteName ? { siteName } : {}),
      ...(publishedAt ? { publishedAt } : {}),
      markdown: truncated.text,
      plainText,
      contentHash: hashArticleText(plainText),
      truncated: truncated.truncated,
    },
    tags: stringList(parsed.frontmatter.tags),
  };
}
