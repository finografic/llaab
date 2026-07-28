import { describe, expect, it } from 'vitest';

import {
  assertResolvedHostAllowed,
  blockedIpReason,
  isInsecureRedirect,
  normalizeCanonicalUrl,
  publicationOrigin,
  validateArticleUrl,
} from './article.url.js';

describe('validateArticleUrl', () => {
  it('accepts ordinary public http and https URLs', () => {
    for (const input of [
      'https://example.com/posts/one',
      'http://example.com/posts/one',
      'https://sub.example.co.uk/a/b?c=1#frag',
    ]) {
      const result = validateArticleUrl(input);
      expect(result.ok, input).toBe(true);
    }
  });

  it('rejects empty, unparseable, and non-http protocols', () => {
    for (const input of [
      '',
      '   ',
      'not a url',
      'ftp://example.com/a',
      'file:///etc/passwd',
      'javascript:alert(1)',
    ]) {
      const result = validateArticleUrl(input);
      expect(result.ok, input).toBe(false);
      if (!result.ok) expect(result.code).toBe('invalid_url');
    }
  });

  it('rejects URLs carrying credentials', () => {
    const result = validateArticleUrl('https://user:secret@example.com/a');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_url');
      expect(result.message).not.toContain('secret');
    }
  });

  it('rejects local hostnames and literal loopback/private addresses', () => {
    for (const input of [
      'http://localhost/a',
      'http://LOCALHOST./a',
      'http://api.localhost/a',
      'http://printer.local/a',
      'http://vault.internal/a',
      'http://127.0.0.1/a',
      'http://127.1.2.3/a',
      'http://10.0.0.5/a',
      'http://172.16.4.1/a',
      'http://172.31.255.255/a',
      'http://192.168.1.1/a',
      'http://169.254.169.254/latest/meta-data',
      'http://100.64.0.1/a',
      'http://0.0.0.0/a',
      'http://224.0.0.1/a',
      'http://255.255.255.255/a',
      'http://[::1]/a',
      'http://[::]/a',
      'http://[fc00::1]/a',
      'http://[fd12:3456::1]/a',
      'http://[fe80::1]/a',
      'http://[ff02::1]/a',
      'http://[::ffff:127.0.0.1]/a',
      'http://[::ffff:169.254.169.254]/a',
    ]) {
      const result = validateArticleUrl(input);
      expect(result.ok, input).toBe(false);
      if (!result.ok) expect(result.code, input).toBe('blocked_target');
    }
  });

  it('allows public literal addresses', () => {
    expect(validateArticleUrl('http://93.184.216.34/a').ok).toBe(true);
    expect(validateArticleUrl('http://172.32.0.1/a').ok).toBe(true);
    expect(validateArticleUrl('http://[2606:2800:220:1:248:1893:25c8:1946]/a').ok).toBe(true);
  });
});

describe('blockedIpReason', () => {
  it('classifies why an address is disallowed', () => {
    expect(blockedIpReason('127.0.0.1')).toBe('loopback');
    expect(blockedIpReason('10.1.2.3')).toBe('private');
    expect(blockedIpReason('169.254.1.1')).toBe('link_local');
    expect(blockedIpReason('100.90.0.1')).toBe('shared_address_space');
    expect(blockedIpReason('239.1.1.1')).toBe('multicast');
    expect(blockedIpReason('::1')).toBe('loopback');
    expect(blockedIpReason('fe80::abcd')).toBe('link_local');
    expect(blockedIpReason('2001:db8::1')).toBe('reserved');
  });

  it('returns undefined for public addresses and non-IP strings', () => {
    expect(blockedIpReason('8.8.8.8')).toBeUndefined();
    expect(blockedIpReason('2606:4700::1111')).toBeUndefined();
    expect(blockedIpReason('example.com')).toBeUndefined();
  });
});

describe('isInsecureRedirect', () => {
  it('permits upgrades and same-scheme hops but refuses downgrades', () => {
    expect(isInsecureRedirect(new URL('http://a.example/x'), new URL('https://a.example/x'))).toBe(false);
    expect(isInsecureRedirect(new URL('https://a.example/x'), new URL('https://b.example/y'))).toBe(false);
    expect(isInsecureRedirect(new URL('https://a.example/x'), new URL('http://b.example/y'))).toBe(true);
  });
});

describe('assertResolvedHostAllowed', () => {
  it('passes when every resolved address is public', async () => {
    const error = await assertResolvedHostAllowed('example.com', {
      resolveHost: async () => [
        { address: '93.184.216.34', family: 4 },
        { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
      ],
    });
    expect(error).toBeUndefined();
  });

  it('blocks when any resolved address is disallowed', async () => {
    const error = await assertResolvedHostAllowed('rebind.example.com', {
      resolveHost: async () => [
        { address: '93.184.216.34', family: 4 },
        { address: '169.254.169.254', family: 4 },
      ],
    });
    expect(error?.code).toBe('blocked_target');
    expect(error?.message).toContain('169.254.169.254');
  });

  it('blocks IPv6 loopback returned by DNS', async () => {
    const error = await assertResolvedHostAllowed('sneaky.example.com', {
      resolveHost: async () => [{ address: '::1', family: 6 }],
    });
    expect(error?.code).toBe('blocked_target');
  });

  it('blocks on resolution failure and on empty answers', async () => {
    const thrown = await assertResolvedHostAllowed('nope.example.com', {
      resolveHost: async () => {
        throw new Error('ENOTFOUND');
      },
    });
    expect(thrown?.code).toBe('blocked_target');

    const empty = await assertResolvedHostAllowed('empty.example.com', {
      resolveHost: async () => [],
    });
    expect(empty?.code).toBe('blocked_target');
  });

  it('judges literal IP hosts without a DNS round trip', async () => {
    let resolverCalls = 0;
    const resolveHost = async () => {
      resolverCalls += 1;
      return [];
    };

    expect(await assertResolvedHostAllowed('93.184.216.34', { resolveHost })).toBeUndefined();
    expect((await assertResolvedHostAllowed('127.0.0.1', { resolveHost }))?.code).toBe('blocked_target');
    expect(resolverCalls).toBe(0);
  });
});

describe('normalizeCanonicalUrl', () => {
  it('strips tracking parameters, fragments, and default ports', () => {
    expect(
      normalizeCanonicalUrl(
        'HTTPS://Example.COM:443/posts/one/?utm_source=it&utm_campaignId=19112267&id=7#section',
      ),
    ).toBe('https://example.com/posts/one?id=7');
  });

  it('sorts remaining parameters so equivalent URLs hash the same', () => {
    expect(normalizeCanonicalUrl('https://example.com/a?b=2&a=1')).toBe(
      normalizeCanonicalUrl('https://example.com/a?a=1&b=2'),
    );
  });

  it('collapses a trailing slash but preserves the root path', () => {
    expect(normalizeCanonicalUrl('https://example.com/a/b/')).toBe('https://example.com/a/b');
    expect(normalizeCanonicalUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('drops embedded credentials rather than carrying them into stored identity', () => {
    expect(normalizeCanonicalUrl('https://user:pw@example.com/a')).toBe('https://example.com/a');
  });

  it('returns the trimmed input when the URL cannot be parsed', () => {
    expect(normalizeCanonicalUrl('  not a url  ')).toBe('not a url');
  });
});

describe('publicationOrigin', () => {
  it('reduces an article URL to its site origin', () => {
    expect(publicationOrigin('https://Signal.Example.com/posts/one?a=1')).toBe('https://signal.example.com');
  });
});
