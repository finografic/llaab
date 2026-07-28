/**
 * URL and network-target validation for article fetching.
 *
 * These helpers are the SSRF control surface. DNS resolution happens immediately before every
 * request — including each redirect hop — because validating only the operator-supplied URL leaves
 * the fetcher open to DNS rebinding and redirect-to-private attacks.
 */

import { lookup } from 'node:dns/promises';

import { ARTICLE_TRACKING_QUERY_PARAMS } from './article.limits.js';

export type BlockedTargetReason =
  | 'unspecified'
  | 'loopback'
  | 'private'
  | 'link_local'
  | 'shared_address_space'
  | 'multicast'
  | 'reserved'
  | 'broadcast';

export interface UrlValidationOk {
  ok: true;
  url: URL;
}

export interface UrlValidationError {
  ok: false;
  code: 'invalid_url' | 'blocked_target';
  message: string;
}

export type UrlValidationResult = UrlValidationOk | UrlValidationError;

function invalid(message: string): UrlValidationError {
  return { ok: false, code: 'invalid_url', message };
}

function blocked(message: string): UrlValidationError {
  return { ok: false, code: 'blocked_target', message };
}

/**
 * Structural validation only: parseable, `http:`/`https:`, no embedded credentials, real hostname.
 * Network-target safety requires {@link assertResolvedHostAllowed}.
 */
export function validateArticleUrl(rawUrl: string): UrlValidationResult {
  const trimmed = rawUrl.trim();
  if (!trimmed) return invalid('No URL supplied.');

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return invalid(`Not a valid URL: "${trimmed}".`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return invalid(`Unsupported protocol "${url.protocol}". Only http and https are accepted.`);
  }

  if (url.username || url.password) {
    return invalid('URLs containing credentials are rejected.');
  }

  if (!url.hostname) {
    return invalid('URL has no hostname.');
  }

  const hostnameReason = blockedHostnameReason(url.hostname);
  if (hostnameReason) {
    return blocked(`Refusing to fetch ${describeReason(hostnameReason)} host "${url.hostname}".`);
  }

  return { ok: true, url };
}

/**
 * A redirect may not downgrade the transport. An `http:` start may upgrade to `https:`, never the
 * reverse, and an `https:` start must stay `https:`.
 */
export function isInsecureRedirect(fromUrl: URL, toUrl: URL): boolean {
  return fromUrl.protocol === 'https:' && toUrl.protocol !== 'https:';
}

const LITERAL_BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
]);

/** Hostname-level rejection for literal IPs and well-known local names. */
export function blockedHostnameReason(hostname: string): BlockedTargetReason | undefined {
  const host = hostname.toLowerCase().replace(/\.$/, '');

  if (LITERAL_BLOCKED_HOSTNAMES.has(host)) return 'loopback';
  if (host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return 'private';
  }

  const literal = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  return blockedIpReason(literal);
}

/** Returns why an IP literal is disallowed, or `undefined` when it is a public address. */
export function blockedIpReason(address: string): BlockedTargetReason | undefined {
  const ipv4 = parseIpv4(address);
  if (ipv4) return blockedIpv4Reason(ipv4);

  const ipv6 = parseIpv6(address);
  if (ipv6) return blockedIpv6Reason(ipv6);

  return undefined;
}

function parseIpv4(address: string): [number, number, number, number] | undefined {
  const parts = address.split('.');
  if (parts.length !== 4) return undefined;

  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return undefined;
    const value = Number(part);
    if (value > 255) return undefined;
    octets.push(value);
  }

  return octets as [number, number, number, number];
}

function blockedIpv4Reason([a, b]: [number, number, number, number]): BlockedTargetReason | undefined {
  if (a === 0) return 'unspecified';
  if (a === 127) return 'loopback';
  if (a === 10) return 'private';
  if (a === 172 && b >= 16 && b <= 31) return 'private';
  if (a === 192 && b === 168) return 'private';
  if (a === 169 && b === 254) return 'link_local';
  if (a === 100 && b >= 64 && b <= 127) return 'shared_address_space';
  if (a === 192 && b === 0) return 'reserved';
  if (a === 192 && b === 88) return 'reserved';
  if (a === 198 && (b === 18 || b === 19)) return 'reserved';
  if (a === 198 && b === 51) return 'reserved';
  if (a === 203 && b === 0) return 'reserved';
  if (a >= 224 && a <= 239) return 'multicast';
  if (a >= 240) return a === 255 && b === 255 ? 'broadcast' : 'reserved';
  return undefined;
}

/** Parses an IPv6 literal (including `::` compression and IPv4-mapped tails) into 8 hextets. */
function parseIpv6(address: string): number[] | undefined {
  if (!address.includes(':')) return undefined;

  const withoutZone = address.split('%')[0] ?? address;
  const doubleColonCount = withoutZone.split('::').length - 1;
  if (doubleColonCount > 1) return undefined;

  const [headText = '', tailText = ''] = doubleColonCount === 1 ? withoutZone.split('::') : [withoutZone, ''];

  const expand = (text: string): number[] | undefined => {
    if (!text) return [];
    const hextets: number[] = [];
    const groups = text.split(':');

    for (const [index, group] of groups.entries()) {
      if (group.includes('.')) {
        if (index !== groups.length - 1) return undefined;
        const ipv4 = parseIpv4(group);
        if (!ipv4) return undefined;
        hextets.push((ipv4[0] << 8) | ipv4[1], (ipv4[2] << 8) | ipv4[3]);
        continue;
      }
      if (!/^[\da-f]{1,4}$/i.test(group)) return undefined;
      hextets.push(Number.parseInt(group, 16));
    }

    return hextets;
  };

  const head = expand(headText);
  const tail = expand(tailText);
  if (!head || !tail) return undefined;

  if (doubleColonCount === 0) {
    return head.length === 8 ? head : undefined;
  }

  const fillLength = 8 - head.length - tail.length;
  if (fillLength < 0) return undefined;

  return [...head, ...Array.from({ length: fillLength }, () => 0), ...tail];
}

function blockedIpv6Reason(hextets: number[]): BlockedTargetReason | undefined {
  const [h0 = 0, h1 = 0, h2 = 0, h3 = 0, h4 = 0, h5 = 0, h6 = 0, h7 = 0] = hextets;

  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-translated: judge the embedded IPv4 address.
  if (h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0xffff) {
    return blockedIpv4Reason([h6 >> 8, h6 & 0xff, h7 >> 8, h7 & 0xff]) ?? undefined;
  }

  const isAllZero = hextets.every((hextet) => hextet === 0);
  if (isAllZero) return 'unspecified';
  if (h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0 && h6 === 0 && h7 === 1) {
    return 'loopback';
  }

  if ((h0 & 0xfe00) === 0xfc00) return 'private'; // fc00::/7 unique local
  if ((h0 & 0xffc0) === 0xfe80) return 'link_local'; // fe80::/10
  if ((h0 & 0xff00) === 0xff00) return 'multicast'; // ff00::/8
  if (h0 === 0x0064 && h1 === 0xff9b) return 'reserved'; // NAT64 well-known prefix
  if (h0 === 0x0100 && h1 === 0 && h2 === 0 && h3 === 0) return 'reserved'; // discard-only
  if (h0 === 0x2001 && h1 === 0x0db8) return 'reserved'; // documentation

  return undefined;
}

export function describeReason(reason: BlockedTargetReason): string {
  switch (reason) {
    case 'unspecified':
      return 'unspecified-address';
    case 'loopback':
      return 'loopback';
    case 'private':
      return 'private-network';
    case 'link_local':
      return 'link-local';
    case 'shared_address_space':
      return 'carrier-grade-NAT';
    case 'multicast':
      return 'multicast';
    case 'broadcast':
      return 'broadcast';
    case 'reserved':
      return 'reserved-range';
  }
}

export interface ResolveHostOptions {
  /** Injectable DNS resolver so tests never touch the network. */
  resolveHost?: (hostname: string) => Promise<Array<{ address: string; family: number }>>;
}

const defaultResolveHost: NonNullable<ResolveHostOptions['resolveHost']> = async (hostname) =>
  await lookup(hostname, { all: true, verbatim: true });

/**
 * Resolves `hostname` and rejects if ANY returned address is disallowed. Call this immediately
 * before each request, including every redirect hop.
 */
export async function assertResolvedHostAllowed(
  hostname: string,
  options: ResolveHostOptions = {},
): Promise<UrlValidationError | undefined> {
  const literalReason = blockedHostnameReason(hostname);
  if (literalReason) {
    return blocked(`Refusing to fetch ${describeReason(literalReason)} host "${hostname}".`);
  }

  // A literal IP needs no DNS round trip; it was fully judged above.
  const bare = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  if (parseIpv4(bare) || parseIpv6(bare)) return undefined;

  const resolve = options.resolveHost ?? defaultResolveHost;

  let records: Array<{ address: string; family: number }>;
  try {
    records = await resolve(hostname);
  } catch {
    return blocked(`Could not resolve host "${hostname}".`);
  }

  if (records.length === 0) {
    return blocked(`Host "${hostname}" resolved to no addresses.`);
  }

  for (const record of records) {
    const reason = blockedIpReason(record.address);
    if (reason) {
      return blocked(`Host "${hostname}" resolves to ${describeReason(reason)} address ${record.address}.`);
    }
  }

  return undefined;
}

/**
 * Deterministic canonical URL normalization: lowercase scheme/host, drop the default port, strip
 * tracking parameters and fragments, sort remaining parameters, and collapse a trailing slash.
 */
export function normalizeCanonicalUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl.trim();
  }

  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  url.hash = '';
  url.username = '';
  url.password = '';

  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
    url.port = '';
  }

  const tracking = new Set<string>(ARTICLE_TRACKING_QUERY_PARAMS);
  const kept = [...url.searchParams.entries()].filter(([key]) => !tracking.has(key.toLowerCase()));
  kept.sort(([leftKey, leftValue], [rightKey, rightValue]) =>
    leftKey === rightKey ? leftValue.localeCompare(rightValue) : leftKey.localeCompare(rightKey),
  );

  url.search = '';
  for (const [key, value] of kept) url.searchParams.append(key, value);

  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '');
  }

  return url.toString();
}

/** Site origin used as the publication `SourceNode` identity. */
export function publicationOrigin(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    return `${url.protocol.toLowerCase()}//${url.hostname.toLowerCase().replace(/\.$/, '')}`;
  } catch {
    return rawUrl.trim();
  }
}
