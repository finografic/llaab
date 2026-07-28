/**
 * Single owning module for article fetch bounds.
 *
 * Every limit the safety contract names lives here so tests can assert the constants directly rather
 * than re-deriving them from call sites.
 */

/** Maximum redirects followed before giving up. Each hop is revalidated. */
export const ARTICLE_MAX_REDIRECTS = 5;

/** Wall-clock budget for the complete fetch, including all redirect hops. */
export const ARTICLE_FETCH_TIMEOUT_MS = 20_000;

/** Hard cap on the response body, enforced while streaming. `Content-Length` alone is not trusted. */
export const ARTICLE_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

/** Minimum non-whitespace characters required for a page to count as a readable article. */
export const ARTICLE_MIN_TEXT_CHARS = 200;

/** Cap on stored normalized Markdown. Longer content is truncated and flagged. */
export const ARTICLE_MAX_MARKDOWN_CHARS = 500_000;

/** Content types accepted as article HTML. Anything else is `unsupported_content_type`. */
export const ARTICLE_ALLOWED_CONTENT_TYPES = ['text/html', 'application/xhtml+xml'] as const;

export const ARTICLE_USER_AGENT = 'LLAAB-ArticleIngest/1.0 (+https://github.com/finografic/llaab)';

export const ARTICLE_ACCEPT_HEADER = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

/** Tracking query parameters stripped during canonical URL normalization. */
export const ARTICLE_TRACKING_QUERY_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'utm_campaignid',
  'utm_reader',
  'utm_name',
  'utm_social',
  'utm_brand',
  'gclid',
  'dclid',
  'fbclid',
  'msclkid',
  'igshid',
  'mc_cid',
  'mc_eid',
  'ref_src',
  'ref_url',
  'spm',
  'vero_id',
  'vero_conv',
  '_hsenc',
  '_hsmi',
  'hsctatracking',
  'oly_anon_id',
  'oly_enc_id',
  'campaignid',
] as const;

/**
 * Returns the bare content type from a `Content-Type` header value, lowercased and parameter-free.
 * Returns `undefined` when the header is absent or empty.
 */
export function parseContentType(headerValue: string | null | undefined): string | undefined {
  const bare = headerValue?.split(';')[0]?.trim().toLowerCase();
  return bare ? bare : undefined;
}

export function isAllowedArticleContentType(contentType: string | undefined): boolean {
  if (!contentType) return false;
  return (ARTICLE_ALLOWED_CONTENT_TYPES as readonly string[]).includes(contentType);
}
