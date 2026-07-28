/**
 * Typed contract for bounded single-URL article fetching.
 *
 * The fetcher never throws for expected conditions; it returns a discriminated result so callers can
 * map a closed failure-code set onto run events without leaking response bodies or secrets.
 */

/** Closed set of expected article fetch/parse failures. */
export const ARTICLE_FETCH_FAILURE_CODES = [
  'invalid_url',
  'blocked_target',
  'insecure_redirect',
  'too_many_redirects',
  'timeout',
  'network_error',
  'http_error',
  'unsupported_content_type',
  'response_too_large',
  'not_readable',
] as const;

export type ArticleFetchFailureCode = (typeof ARTICLE_FETCH_FAILURE_CODES)[number];

/** Operator-safe failure. Never carries response bodies, headers, or credentials. */
export interface ArticleFetchFailure {
  ok: false;
  code: ArticleFetchFailureCode;
  message: string;
  requestedUrl: string;
  finalUrl?: string;
  httpStatus?: number;
}

/** Deterministic readable article extracted from one HTML document. */
export interface FetchedArticle {
  /** URL exactly as supplied by the operator, before normalization or redirects. */
  requestedUrl: string;
  /** URL of the response that was actually parsed, after following redirects. */
  finalUrl: string;
  /** Durable identity: `<link rel="canonical">` or `og:url` when trustworthy, else `finalUrl`. */
  canonicalUrl: string;
  title: string;
  byline?: string;
  siteName?: string;
  excerpt?: string;
  /** ISO 8601 UTC publication timestamp when the page declares one. */
  publishedAt?: string;
  language?: string;
  markdown: string;
  plainText: string;
  /** SHA-256 hex digest of normalized `plainText`, not of the raw HTML. */
  contentHash: string;
  truncated: boolean;
}

export type FetchArticleResult = ({ ok: true } & FetchedArticle) | ArticleFetchFailure;

export function articleFetchFailure(
  code: ArticleFetchFailureCode,
  message: string,
  context: { requestedUrl: string; finalUrl?: string; httpStatus?: number },
): ArticleFetchFailure {
  return {
    ok: false,
    code,
    message,
    requestedUrl: context.requestedUrl,
    ...(context.finalUrl ? { finalUrl: context.finalUrl } : {}),
    ...(context.httpStatus === undefined ? {} : { httpStatus: context.httpStatus }),
  };
}

export function isArticleFetchFailure(result: FetchArticleResult): result is ArticleFetchFailure {
  return result.ok === false;
}
