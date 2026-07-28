/**
 * Bounded single-URL article fetching.
 *
 * Redirects are followed manually so every hop is revalidated — protocol, target policy, and DNS —
 * rather than trusting the runtime's redirect handling. The body is size-checked while streaming
 * because a declared `Content-Length` is a claim, not a fact.
 */

import type { ArticleFetchFailure, FetchArticleResult } from './article.contract.js';
import type { ResolveHostOptions } from './article.url.js';

import { articleFetchFailure } from './article.contract.js';
import {
  ARTICLE_ACCEPT_HEADER,
  ARTICLE_FETCH_TIMEOUT_MS,
  ARTICLE_MAX_REDIRECTS,
  ARTICLE_MAX_RESPONSE_BYTES,
  ARTICLE_USER_AGENT,
  isAllowedArticleContentType,
  parseContentType,
} from './article.limits.js';
import { parseArticle } from './article.parse.js';
import { assertResolvedHostAllowed, isInsecureRedirect, validateArticleUrl } from './article.url.js';

export interface FetchArticleOptions extends ResolveHostOptions {
  /** Injectable fetch so tests exercise redirect, size, and MIME handling without a network. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxRedirects?: number;
  maxResponseBytes?: number;
}

interface RawResponse {
  finalUrl: string;
  html: string;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** Reads the body, aborting as soon as the byte budget is exceeded. */
async function readBoundedBody(
  response: Response,
  maxBytes: number,
): Promise<{ ok: true; text: string } | { ok: false }> {
  const body = response.body;

  // No stream available (some mocks, and 204-style responses): fall back to a buffered read that is
  // still length-checked before it is decoded.
  if (!body) {
    const text = await response.text();
    return Buffer.byteLength(text, 'utf8') > maxBytes ? { ok: false } : { ok: true, text };
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock?.();
  }

  return { ok: true, text: Buffer.concat(chunks).toString('utf8') };
}

/**
 * Fetches one URL, following and revalidating redirects, and returns the terminal HTML document.
 * Exported for tests that need the transport layer without the parser.
 */
export async function fetchArticleDocument(
  requestedUrl: string,
  options: FetchArticleOptions = {},
): Promise<{ ok: true; value: RawResponse } | ArticleFetchFailure> {
  const {
    fetchImpl = fetch,
    timeoutMs = ARTICLE_FETCH_TIMEOUT_MS,
    maxRedirects = ARTICLE_MAX_REDIRECTS,
    maxResponseBytes = ARTICLE_MAX_RESPONSE_BYTES,
    resolveHost,
  } = options;

  const validated = validateArticleUrl(requestedUrl);
  if (!validated.ok) {
    return articleFetchFailure(validated.code, validated.message, { requestedUrl });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let currentUrl = validated.url;

    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      const blocked = await assertResolvedHostAllowed(currentUrl.hostname, { resolveHost });
      if (blocked) {
        return articleFetchFailure('blocked_target', blocked.message, {
          requestedUrl,
          finalUrl: currentUrl.toString(),
        });
      }

      let response: Response;
      try {
        response = await fetchImpl(currentUrl.toString(), {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            'user-agent': ARTICLE_USER_AGENT,
            'accept': ARTICLE_ACCEPT_HEADER,
            'accept-language': 'en',
          },
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return articleFetchFailure('timeout', `Fetch exceeded ${timeoutMs}ms.`, {
            requestedUrl,
            finalUrl: currentUrl.toString(),
          });
        }
        // The cause of a network error can echo internal detail, so it is deliberately not included.
        void error;
        return articleFetchFailure('network_error', 'The request could not be completed.', {
          requestedUrl,
          finalUrl: currentUrl.toString(),
        });
      }

      if (REDIRECT_STATUSES.has(response.status)) {
        const location = response.headers.get('location');
        if (!location) {
          return articleFetchFailure('http_error', `Redirect ${response.status} carried no location.`, {
            requestedUrl,
            finalUrl: currentUrl.toString(),
            httpStatus: response.status,
          });
        }

        let nextUrl: URL;
        try {
          nextUrl = new URL(location, currentUrl);
        } catch {
          return articleFetchFailure('invalid_url', 'Redirect target is not a valid URL.', {
            requestedUrl,
            finalUrl: currentUrl.toString(),
            httpStatus: response.status,
          });
        }

        if (isInsecureRedirect(currentUrl, nextUrl)) {
          return articleFetchFailure('insecure_redirect', 'Redirect downgraded https to http.', {
            requestedUrl,
            finalUrl: nextUrl.toString(),
            httpStatus: response.status,
          });
        }

        const revalidated = validateArticleUrl(nextUrl.toString());
        if (!revalidated.ok) {
          return articleFetchFailure(revalidated.code, revalidated.message, {
            requestedUrl,
            finalUrl: nextUrl.toString(),
            httpStatus: response.status,
          });
        }

        currentUrl = revalidated.url;
        continue;
      }

      if (!response.ok) {
        return articleFetchFailure('http_error', `Upstream responded ${response.status}.`, {
          requestedUrl,
          finalUrl: currentUrl.toString(),
          httpStatus: response.status,
        });
      }

      const contentType = parseContentType(response.headers.get('content-type'));
      if (!isAllowedArticleContentType(contentType)) {
        return articleFetchFailure(
          'unsupported_content_type',
          `Unsupported content type "${contentType ?? 'unknown'}"; only HTML is ingested.`,
          { requestedUrl, finalUrl: currentUrl.toString(), httpStatus: response.status },
        );
      }

      const declaredLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
        return articleFetchFailure(
          'response_too_large',
          `Response exceeds the ${maxResponseBytes}-byte limit.`,
          { requestedUrl, finalUrl: currentUrl.toString(), httpStatus: response.status },
        );
      }

      let body: Awaited<ReturnType<typeof readBoundedBody>>;
      try {
        body = await readBoundedBody(response, maxResponseBytes);
      } catch {
        if (controller.signal.aborted) {
          return articleFetchFailure('timeout', `Fetch exceeded ${timeoutMs}ms.`, {
            requestedUrl,
            finalUrl: currentUrl.toString(),
          });
        }
        return articleFetchFailure('network_error', 'The response body could not be read.', {
          requestedUrl,
          finalUrl: currentUrl.toString(),
        });
      }

      if (!body.ok) {
        return articleFetchFailure(
          'response_too_large',
          `Response exceeds the ${maxResponseBytes}-byte limit.`,
          { requestedUrl, finalUrl: currentUrl.toString(), httpStatus: response.status },
        );
      }

      return { ok: true, value: { finalUrl: currentUrl.toString(), html: body.text } };
    }

    return articleFetchFailure('too_many_redirects', `Exceeded the ${maxRedirects}-redirect limit.`, {
      requestedUrl,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches and parses one public article URL.
 *
 * Returns a {@link FetchedArticle} on success or a typed, operator-safe failure. Expected conditions
 * never throw.
 */
export async function fetchArticle(
  requestedUrl: string,
  options: FetchArticleOptions = {},
): Promise<FetchArticleResult> {
  const fetched = await fetchArticleDocument(requestedUrl, options);
  if (!fetched.ok) return fetched;

  return parseArticle({
    html: fetched.value.html,
    requestedUrl,
    finalUrl: fetched.value.finalUrl,
  });
}
