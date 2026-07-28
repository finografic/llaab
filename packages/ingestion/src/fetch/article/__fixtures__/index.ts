/** Fixture loader so article parsing tests never touch the network. */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixturesDir = dirname(fileURLToPath(import.meta.url));

export const ARTICLE_FIXTURES = {
  /** Semantic `<article>` with canonical link, author, site name, and published time. */
  semanticArticle: 'semantic-article.html',
  /** Metadata available only through Open Graph / article meta tags; no `<title>`, no canonical. */
  openGraphOnly: 'open-graph-only.html',
  /** Relative, root-relative, protocol-relative, and fragment links plus a `<base href>`. */
  relativeLinks: 'relative-links.html',
  /** Heavy page furniture: nav, cookie banner, forms, related rails, scripts, and styles. */
  noisyNavigation: 'noisy-navigation.html',
  /** Recoverable tag soup: unclosed headings/paragraphs, unquoted attributes, duplicated `<body>`. */
  malformed: 'malformed.html',
  /** Unclosed `<title>`: RCDATA swallows the document, so every conforming parser sees an empty body. */
  unterminatedTitle: 'unterminated-title.html',
  /** Client-rendered shell with no prose — must fail as `not_readable`. */
  noReadableArticle: 'no-readable-article.html',
  /** Terminal document of a redirect chain. */
  redirectTarget: 'redirect-target.html',
} as const;

export type ArticleFixtureName = keyof typeof ARTICLE_FIXTURES;

export function readArticleFixture(name: ArticleFixtureName): string {
  return readFileSync(join(fixturesDir, ARTICLE_FIXTURES[name]), 'utf8');
}
