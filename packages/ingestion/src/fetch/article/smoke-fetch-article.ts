/**
 * Opt-in live smoke check for article fetching. Never runs in CI — every automated test in this
 * directory is fixture-backed.
 *
 * Usage: `bun packages/ingestion/src/fetch/article/smoke-fetch-article.ts <url>`
 */

import { fetchArticle } from './fetch-article.js';

const url = process.argv[2];

if (!url) {
  console.error('Usage: smoke-fetch-article.ts <article-url>');
  process.exit(1);
}

const result = await fetchArticle(url);

if (!result.ok) {
  console.error(`FAILED [${result.code}] ${result.message}`);
  console.error(`  requested: ${result.requestedUrl}`);
  if (result.finalUrl) console.error(`  final:     ${result.finalUrl}`);
  if (result.httpStatus) console.error(`  status:    ${result.httpStatus}`);
  process.exit(1);
}

console.log(`title:       ${result.title}`);
console.log(`byline:      ${result.byline ?? '—'}`);
console.log(`site:        ${result.siteName ?? '—'}`);
console.log(`published:   ${result.publishedAt ?? '—'}`);
console.log(`language:    ${result.language ?? '—'}`);
console.log(`requested:   ${result.requestedUrl}`);
console.log(`final:       ${result.finalUrl}`);
console.log(`canonical:   ${result.canonicalUrl}`);
console.log(`hash:        ${result.contentHash}`);
console.log(`truncated:   ${result.truncated}`);
console.log(`markdown:    ${result.markdown.length} chars`);
console.log(`\n--- first 600 chars ---\n${result.markdown.slice(0, 600)}`);
