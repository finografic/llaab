import { describe, expect, it } from 'vitest';
import type { FetchArticleOptions } from './fetch-article.js';

import { readArticleFixture } from './__fixtures__/index.js';
import { fetchArticle, fetchArticleDocument } from './fetch-article.js';

/** Every test resolves hostnames to a fixed public address unless it is testing DNS itself. */
const publicDns: FetchArticleOptions['resolveHost'] = async () => [{ address: '93.184.216.34', family: 4 }];

function htmlResponse(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
    ...init,
  });
}

function redirectResponse(location: string, status = 302): Response {
  return new Response(null, { status, headers: { location } });
}

/** Serves a scripted sequence of responses, recording the URLs requested. */
function scriptedFetch(responses: Response[]): { impl: typeof fetch; urls: string[] } {
  const urls: string[] = [];
  let index = 0;

  // The fetcher always passes a string URL, so the mock narrows rather than handling every overload.
  const impl = (async (input: string) => {
    urls.push(input);
    const response = responses[index];
    index += 1;
    if (!response) throw new Error(`No scripted response for request ${index}`);
    return response;
  }) as unknown as typeof fetch;

  return { impl, urls };
}

const articleHtml = readArticleFixture('semanticArticle');

describe('fetchArticle — success', () => {
  it('fetches, parses, and returns a typed article', async () => {
    const { impl, urls } = scriptedFetch([htmlResponse(articleHtml)]);

    const result = await fetchArticle('https://signal.example.com/posts/bounded-fetching', {
      fetchImpl: impl,
      resolveHost: publicDns,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.title).toContain('Bounded Fetching for Knowledge Systems');
    expect(result.canonicalUrl).toBe('https://signal.example.com/posts/bounded-fetching');
    expect(urls).toEqual(['https://signal.example.com/posts/bounded-fetching']);
  });

  it('sends a stable user agent and an HTML Accept header', async () => {
    let seenHeaders: Record<string, string> = {};
    const impl = (async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      seenHeaders = (init?.headers ?? {}) as Record<string, string>;
      return htmlResponse(articleHtml);
    }) as typeof fetch;

    await fetchArticle('https://signal.example.com/a', { fetchImpl: impl, resolveHost: publicDns });

    expect(seenHeaders['user-agent']).toContain('LLAAB');
    expect(seenHeaders.accept).toContain('text/html');
  });

  it('accepts application/xhtml+xml', async () => {
    const { impl } = scriptedFetch([
      htmlResponse(articleHtml, { headers: { 'content-type': 'application/xhtml+xml' } }),
    ]);

    const result = await fetchArticle('https://signal.example.com/a', {
      fetchImpl: impl,
      resolveHost: publicDns,
    });
    expect(result.ok).toBe(true);
  });
});

describe('fetchArticle — redirects', () => {
  it('follows a chain and parses the terminal document', async () => {
    const { impl, urls } = scriptedFetch([
      redirectResponse('https://signal.example.com/step-2'),
      redirectResponse('/step-3', 301),
      htmlResponse(readArticleFixture('redirectTarget')),
    ]);

    const result = await fetchArticle('https://sho.rt/abc', { fetchImpl: impl, resolveHost: publicDns });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.requestedUrl).toBe('https://sho.rt/abc');
    expect(result.finalUrl).toBe('https://signal.example.com/step-3');
    expect(urls).toEqual([
      'https://sho.rt/abc',
      'https://signal.example.com/step-2',
      'https://signal.example.com/step-3',
    ]);
  });

  it('fails once the redirect budget is exhausted', async () => {
    const impl = (async () => redirectResponse('https://example.com/next')) as typeof fetch;

    const result = await fetchArticle('https://example.com/start', {
      fetchImpl: impl,
      resolveHost: publicDns,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('too_many_redirects');
  });

  it('refuses an https → http downgrade', async () => {
    const { impl } = scriptedFetch([redirectResponse('http://insecure.example.com/a')]);

    const result = await fetchArticle('https://secure.example.com/a', {
      fetchImpl: impl,
      resolveHost: publicDns,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('insecure_redirect');
  });

  it('revalidates each hop and blocks a redirect into a private range', async () => {
    const { impl } = scriptedFetch([redirectResponse('http://169.254.169.254/latest/meta-data')]);

    const result = await fetchArticle('http://public.example.com/a', {
      fetchImpl: impl,
      resolveHost: publicDns,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('blocked_target');
  });

  it('re-resolves DNS on every hop, catching a rebind after the first check', async () => {
    const { impl } = scriptedFetch([redirectResponse('https://second.example.com/a')]);

    let call = 0;
    const rebindingDns: FetchArticleOptions['resolveHost'] = async () => {
      call += 1;
      return call === 1 ? [{ address: '93.184.216.34', family: 4 }] : [{ address: '10.0.0.7', family: 4 }];
    };

    const result = await fetchArticle('https://first.example.com/a', {
      fetchImpl: impl,
      resolveHost: rebindingDns,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('blocked_target');
    expect(result.message).toContain('10.0.0.7');
  });

  it('rejects a redirect with no location header', async () => {
    const { impl } = scriptedFetch([new Response(null, { status: 302 })]);

    const result = await fetchArticle('https://example.com/a', {
      fetchImpl: impl,
      resolveHost: publicDns,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('http_error');
  });
});

describe('fetchArticle — rejected inputs and targets', () => {
  it('rejects a malformed URL before any request is made', async () => {
    let called = false;
    const impl = (async () => {
      called = true;
      return htmlResponse(articleHtml);
    }) as typeof fetch;

    const result = await fetchArticle('not a url', { fetchImpl: impl, resolveHost: publicDns });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('invalid_url');
    expect(called).toBe(false);
  });

  it('rejects credentials in the URL without echoing the password', async () => {
    const result = await fetchArticle('https://user:hunter2@example.com/a', { resolveHost: publicDns });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('invalid_url');
    expect(JSON.stringify(result)).not.toContain('hunter2');
  });

  it('blocks a loopback target before connecting', async () => {
    const result = await fetchArticle('http://127.0.0.1:8888/admin', { resolveHost: publicDns });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('blocked_target');
  });

  it('blocks a hostname that resolves into a private range', async () => {
    const result = await fetchArticle('https://intranet.example.com/a', {
      fetchImpl: (async () => htmlResponse(articleHtml)) as typeof fetch,
      resolveHost: async () => [{ address: '192.168.1.10', family: 4 }],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('blocked_target');
  });
});

describe('fetchArticle — response handling', () => {
  it('reports a non-2xx status without leaking the body', async () => {
    const { impl } = scriptedFetch([
      new Response('<html>secret internal error trace</html>', {
        status: 503,
        headers: { 'content-type': 'text/html' },
      }),
    ]);

    const result = await fetchArticle('https://example.com/a', {
      fetchImpl: impl,
      resolveHost: publicDns,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('http_error');
    expect(result.httpStatus).toBe(503);
    expect(JSON.stringify(result)).not.toContain('secret internal error trace');
  });

  it('reports a PDF as an unsupported content type', async () => {
    const { impl } = scriptedFetch([
      new Response('%PDF-1.7', { status: 200, headers: { 'content-type': 'application/pdf' } }),
    ]);

    const result = await fetchArticle('https://example.com/paper.pdf', {
      fetchImpl: impl,
      resolveHost: publicDns,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('unsupported_content_type');
  });

  it('rejects an oversized body declared by content-length', async () => {
    const { impl } = scriptedFetch([
      htmlResponse(articleHtml, {
        headers: { 'content-type': 'text/html', 'content-length': String(50 * 1024 * 1024) },
      }),
    ]);

    const result = await fetchArticle('https://example.com/a', {
      fetchImpl: impl,
      resolveHost: publicDns,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('response_too_large');
  });

  it('rejects an oversized body that lies about its content-length', async () => {
    const oversized = 'x'.repeat(20_000);
    const { impl } = scriptedFetch([
      new Response(oversized, {
        status: 200,
        headers: { 'content-type': 'text/html', 'content-length': '10' },
      }),
    ]);

    const result = await fetchArticle('https://example.com/a', {
      fetchImpl: impl,
      resolveHost: publicDns,
      maxResponseBytes: 5_000,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('response_too_large');
  });

  it('reports a timeout when the request is aborted by the budget', async () => {
    const impl = (async (_input: Parameters<typeof fetch>[0], init?: RequestInit) =>
      await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as typeof fetch;

    const result = await fetchArticle('https://slow.example.com/a', {
      fetchImpl: impl,
      resolveHost: publicDns,
      timeoutMs: 20,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('timeout');
  });

  it('reports a network error without echoing the underlying cause', async () => {
    const impl = (async () => {
      throw new Error('ECONNREFUSED 10.0.0.1:443');
    }) as typeof fetch;

    const result = await fetchArticle('https://example.com/a', {
      fetchImpl: impl,
      resolveHost: publicDns,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('network_error');
    expect(JSON.stringify(result)).not.toContain('ECONNREFUSED');
  });

  it('surfaces a parse failure for an HTML page with no article', async () => {
    const { impl } = scriptedFetch([htmlResponse(readArticleFixture('noReadableArticle'))]);

    const result = await fetchArticle('https://spa.example.com/', {
      fetchImpl: impl,
      resolveHost: publicDns,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('not_readable');
  });
});

describe('fetchArticleDocument', () => {
  it('returns the terminal URL and raw HTML without parsing', async () => {
    const { impl } = scriptedFetch([
      redirectResponse('https://example.com/final'),
      htmlResponse('<html><body><p>raw</p></body></html>'),
    ]);

    const result = await fetchArticleDocument('https://example.com/start', {
      fetchImpl: impl,
      resolveHost: publicDns,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.finalUrl).toBe('https://example.com/final');
    expect(result.value.html).toContain('<p>raw</p>');
  });
});
