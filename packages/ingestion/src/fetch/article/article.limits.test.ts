import { describe, expect, it } from 'vitest';

import { ARTICLE_FETCH_FAILURE_CODES, articleFetchFailure } from './article.contract.js';
import {
  ARTICLE_FETCH_TIMEOUT_MS,
  ARTICLE_MAX_MARKDOWN_CHARS,
  ARTICLE_MAX_REDIRECTS,
  ARTICLE_MAX_RESPONSE_BYTES,
  ARTICLE_MIN_TEXT_CHARS,
  isAllowedArticleContentType,
  parseContentType,
} from './article.limits.js';

describe('article fetch limits', () => {
  it('pins the values named in the safety contract', () => {
    expect(ARTICLE_MAX_REDIRECTS).toBe(5);
    expect(ARTICLE_FETCH_TIMEOUT_MS).toBe(20_000);
    expect(ARTICLE_MAX_RESPONSE_BYTES).toBe(5 * 1024 * 1024);
    expect(ARTICLE_MIN_TEXT_CHARS).toBe(200);
    expect(ARTICLE_MAX_MARKDOWN_CHARS).toBe(500_000);
  });
});

describe('parseContentType', () => {
  it('drops parameters and normalizes case', () => {
    expect(parseContentType('text/HTML; charset=UTF-8')).toBe('text/html');
    expect(parseContentType('  application/xhtml+xml  ')).toBe('application/xhtml+xml');
  });

  it('returns undefined when the header is missing or empty', () => {
    expect(parseContentType(null)).toBeUndefined();
    expect(parseContentType(undefined)).toBeUndefined();
    expect(parseContentType('   ')).toBeUndefined();
  });
});

describe('isAllowedArticleContentType', () => {
  it('accepts HTML and XHTML only', () => {
    expect(isAllowedArticleContentType('text/html')).toBe(true);
    expect(isAllowedArticleContentType('application/xhtml+xml')).toBe(true);
  });

  it('rejects documents that need a different parser', () => {
    for (const contentType of [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'application/json',
      'text/plain',
      undefined,
    ]) {
      expect(isAllowedArticleContentType(contentType), String(contentType)).toBe(false);
    }
  });
});

describe('articleFetchFailure', () => {
  it('builds an operator-safe failure carrying only the fields it was given', () => {
    const failure = articleFetchFailure('http_error', 'Upstream returned 503.', {
      requestedUrl: 'https://example.com/a',
      finalUrl: 'https://example.com/b',
      httpStatus: 503,
    });

    expect(failure).toEqual({
      ok: false,
      code: 'http_error',
      message: 'Upstream returned 503.',
      requestedUrl: 'https://example.com/a',
      finalUrl: 'https://example.com/b',
      httpStatus: 503,
    });
  });

  it('omits optional context rather than emitting undefined keys', () => {
    const failure = articleFetchFailure('timeout', 'Timed out.', {
      requestedUrl: 'https://example.com/a',
    });
    expect(Object.keys(failure).sort()).toEqual(['code', 'message', 'ok', 'requestedUrl']);
  });

  it('keeps the failure-code set closed', () => {
    expect([...ARTICLE_FETCH_FAILURE_CODES]).toEqual([
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
    ]);
  });
});
