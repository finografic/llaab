import { XMLParser } from 'fast-xml-parser';

export interface FetchedPodcastEpisode {
  podcastTitle: string;
  episodeTitle: string;
  description?: string;
  publishedAt?: string;
  durationSeconds?: number;
  /** Dedupe key — RSS `<guid>`, falling back to the normalized enclosure URL. */
  episodeGuid: string;
  feedUrl: string;
  audioUrl: string;
  audioMimeType?: string;
  rssTranscriptUrl?: string;
  rssTranscriptType?: string;
  showWebsite?: string;
}

const POCKET_CASTS_HOSTNAMES = new Set(['pca.st', 'pocketcasts.com', 'www.pocketcasts.com']);

export function isPocketCastsUrl(value: string): boolean {
  try {
    const { hostname } = new URL(value);
    return POCKET_CASTS_HOSTNAMES.has(hostname.toLowerCase());
  } catch {
    return false;
  }
}

function metaContent(html: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1].trim());
  }
  return undefined;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'");
}

function ogTag(property: string): RegExp[] {
  return [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i'),
  ];
}

interface ResolvedPocketCastsPage {
  finalUrl: string;
  html: string;
  ogTitle?: string;
  ogDescription?: string;
  feedUrlHint?: string;
  oembedUrl?: string;
}

function rssLinkFromHtml(html: string): string | undefined {
  return html.match(
    /<link[^>]+rel=["']alternate["'][^>]+type=["']application\/rss\+xml["'][^>]+href=["']([^"']+)["']/i,
  )?.[1];
}

async function resolvePocketCastsPage(url: string): Promise<ResolvedPocketCastsPage> {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Could not resolve Pocket Casts link (HTTP ${response.status}): ${url}`);
  }

  const html = await response.text();

  return {
    finalUrl: response.url || url,
    html,
    ogTitle: metaContent(html, ogTag('og:title')),
    ogDescription: metaContent(html, ogTag('og:description')),
    feedUrlHint: rssLinkFromHtml(html),
    oembedUrl: html.match(/<link[^>]+type=["']application\/json\+oembed["'][^>]+href=["']([^"']+)["']/i)?.[1],
  };
}

interface PocketCastsOembed {
  title?: string;
  author_name?: string;
  author_url?: string;
}

/**
 * Pocket Casts serves a standard, publicly documented oEmbed endpoint for every episode share
 * page — a much more reliable source for the show name and website than page meta tags, which
 * don't consistently include the podcast title (Pocket Casts' `og:title` is episode-only).
 */
async function fetchOembed(oembedUrl: string): Promise<PocketCastsOembed | undefined> {
  const response = await fetch(oembedUrl);
  if (!response.ok) return undefined;
  return (await response.json()) as PocketCastsOembed;
}

interface PocketCastsIdentity {
  podcastTitle?: string;
  episodeTitle?: string;
  showWebsite?: string;
}

async function resolvePocketCastsIdentity(page: ResolvedPocketCastsPage): Promise<PocketCastsIdentity> {
  const oembed = page.oembedUrl ? await fetchOembed(page.oembedUrl) : undefined;

  if (oembed?.author_name) {
    const suffix = ` - ${oembed.author_name}`;
    const episodeTitle =
      oembed.title && oembed.title.endsWith(suffix)
        ? oembed.title.slice(0, -suffix.length)
        : (oembed.title ?? page.ogTitle);

    return { podcastTitle: oembed.author_name, episodeTitle, showWebsite: oembed.author_url };
  }

  return { episodeTitle: page.ogTitle };
}

async function resolveFeedUrl(
  page: ResolvedPocketCastsPage,
  identity: PocketCastsIdentity,
): Promise<string | undefined> {
  if (page.feedUrlHint) return page.feedUrlHint;

  if (identity.showWebsite) {
    try {
      const showPage = await fetch(identity.showWebsite);
      if (showPage.ok) {
        const feedUrl = rssLinkFromHtml(await showPage.text());
        if (feedUrl) return new URL(feedUrl, identity.showWebsite).toString();
      }
    } catch {
      // Fall through to Podcast Index lookup.
    }
  }

  if (identity.podcastTitle) {
    const podcastIndexFeed = await lookupFeedViaPodcastIndex(identity.podcastTitle);
    if (podcastIndexFeed) return podcastIndexFeed;
  }

  return undefined;
}

async function lookupFeedViaPodcastIndex(podcastTitle: string): Promise<string | undefined> {
  const apiKey = process.env.PODCASTINDEX_API_KEY;
  const apiSecret = process.env.PODCASTINDEX_API_SECRET;
  if (!apiKey || !apiSecret) return undefined;

  const encoder = new TextEncoder();
  const authTime = Math.floor(Date.now() / 1000).toString();
  const digest = await crypto.subtle.digest('SHA-1', encoder.encode(apiKey + apiSecret + authTime));
  const authHash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  const response = await fetch(
    `https://api.podcastindex.org/api/1.0/search/byterm?q=${encodeURIComponent(podcastTitle)}`,
    {
      headers: {
        'X-Auth-Key': apiKey,
        'X-Auth-Date': authTime,
        'Authorization': authHash,
        'User-Agent': 'LLAAB/1.0',
      },
    },
  );

  if (!response.ok) return undefined;

  const data = (await response.json()) as { feeds?: Array<{ url?: string; title?: string }> };
  const match = data.feeds?.find(
    (feed) => feed.title?.trim().toLowerCase() === podcastTitle.trim().toLowerCase(),
  );
  return match?.url ?? data.feeds?.[0]?.url;
}

interface FeedItem {
  'title'?: string;
  'guid'?: string | { '#text'?: string };
  'pubDate'?: string;
  'description'?: string;
  'enclosure'?: { '@_url'?: string; '@_type'?: string };
  'itunes:duration'?: string | number;
  'podcast:transcript'?:
    | { '@_url'?: string; '@_type'?: string }
    | Array<{ '@_url'?: string; '@_type'?: string }>;
}

function itemGuid(item: FeedItem): string | undefined {
  if (typeof item.guid === 'string') return item.guid;
  return item.guid?.['#text'];
}

function itemDurationSeconds(item: FeedItem): number | undefined {
  const raw = item['itunes:duration'];
  if (raw === undefined) return undefined;
  if (typeof raw === 'number') return raw;
  if (/^\d+$/.test(raw)) return Number.parseInt(raw, 10);
  const parts = raw.split(':').map((part) => Number.parseInt(part, 10));
  if (parts.some(Number.isNaN)) return undefined;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function itemTranscript(item: FeedItem): { url?: string; type?: string } {
  const raw = item['podcast:transcript'];
  const candidates = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const preferred =
    candidates.find((t) => t['@_type'] === 'text/vtt') ??
    candidates.find((t) => t['@_type'] === 'text/plain') ??
    candidates[0];
  return { url: preferred?.['@_url'], type: preferred?.['@_type'] };
}

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function titleSimilarity(a: string, b: string): number {
  const normA = normalizeTitle(a);
  const normB = normalizeTitle(b);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;
  if (normA.includes(normB) || normB.includes(normA)) return 0.8;

  const tokensA = new Set(normA.split(' '));
  const tokensB = new Set(normB.split(' '));
  const shared = [...tokensA].filter((token) => tokensB.has(token)).length;
  return shared / Math.max(tokensA.size, tokensB.size);
}

function scoreEpisodeMatch(item: FeedItem, episodeTitle: string): number {
  const title = item.title ?? '';
  const normalizedMatch = normalizeTitle(title) === normalizeTitle(episodeTitle) ? 100 : 0;
  const similarity = titleSimilarity(title, episodeTitle) * 60;
  return normalizedMatch + similarity;
}

const MIN_EPISODE_MATCH_SCORE = 60;

async function fetchFeedItems(feedUrl: string): Promise<{ feed: FeedItem[]; showTitle?: string }> {
  const response = await fetch(feedUrl);
  if (!response.ok) {
    throw new Error(`Could not fetch podcast RSS feed (HTTP ${response.status}): ${feedUrl}`);
  }

  const xml = await response.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml) as {
    rss?: { channel?: { title?: string; item?: FeedItem | FeedItem[] } };
  };

  const channel = parsed.rss?.channel;
  const items = channel?.item;
  const feed = Array.isArray(items) ? items : items ? [items] : [];
  return { feed, showTitle: channel?.title };
}

/**
 * Resolves a Pocket Casts episode share link to a provider-neutral episode record: follows the
 * redirect, extracts page metadata, resolves the show's RSS feed, and matches the specific
 * episode inside it. Pocket Casts is treated purely as a URL resolver — the durable identity
 * carried forward is the RSS feed URL + episode guid, not the Pocket Casts link.
 */
export async function fetchPodcastEpisode(url: string): Promise<FetchedPodcastEpisode> {
  const page = await resolvePocketCastsPage(url);
  const identity = await resolvePocketCastsIdentity(page);
  const podcastTitle = identity.podcastTitle ?? 'Unknown podcast';
  const episodeTitle = identity.episodeTitle ?? 'Untitled episode';

  const feedUrl = await resolveFeedUrl(page, identity);
  if (!feedUrl) {
    throw new Error(
      `Could not resolve an RSS feed for "${podcastTitle}". Set PODCASTINDEX_API_KEY / ` +
        'PODCASTINDEX_API_SECRET to enable feed lookup by title, or ensure the show page links its feed.',
    );
  }

  const { feed, showTitle } = await fetchFeedItems(feedUrl);
  if (feed.length === 0) {
    throw new Error(`Podcast feed at ${feedUrl} has no items.`);
  }

  let best: { item: FeedItem; score: number } | undefined;
  for (const item of feed) {
    const score = scoreEpisodeMatch(item, episodeTitle);
    if (!best || score > best.score) best = { item, score };
  }

  if (!best || best.score < MIN_EPISODE_MATCH_SCORE) {
    throw new Error(
      `Could not confidently match episode "${episodeTitle}" in feed ${feedUrl} ` +
        `(best score ${best?.score.toFixed(0) ?? 0}).`,
    );
  }

  const matched = best.item;
  const audioUrl = matched.enclosure?.['@_url'];
  if (!audioUrl) {
    throw new Error(`Matched episode "${matched.title ?? episodeTitle}" has no audio enclosure URL.`);
  }

  const transcript = itemTranscript(matched);
  const guid = itemGuid(matched) ?? audioUrl;

  return {
    podcastTitle: showTitle ?? podcastTitle,
    episodeTitle: matched.title ?? episodeTitle,
    description: matched.description ?? page.ogDescription,
    publishedAt: matched.pubDate ? new Date(matched.pubDate).toISOString() : undefined,
    durationSeconds: itemDurationSeconds(matched),
    episodeGuid: guid,
    feedUrl,
    audioUrl,
    audioMimeType: matched.enclosure?.['@_type'],
    rssTranscriptUrl: transcript.url,
    rssTranscriptType: transcript.type,
  };
}
