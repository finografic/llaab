import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchPodcastEpisode, isPocketCastsUrl } from './podcast.js';

const POCKET_CASTS_URL = 'https://pca.st/episode/0bd00def-49cf-43f3-a252-acb837815d31';
const OEMBED_URL = 'https://pca.st/oembed/example';
const SHOW_URL = 'https://typescript.fm';
const FEED_URL = 'https://feeds.transistor.fm/typescript-fm';

function pocketCastsPageHtml() {
  return [
    '<html><head>',
    '<meta property="og:title" content="Announcing TypeScript 7, Bun 1.4 is in Rust | News | Ep 74">',
    '<meta property="og:description" content="A TypeScript news episode.">',
    `<link type="application/json+oembed" href="${OEMBED_URL}">`,
    '</head><body></body></html>',
  ].join('');
}

function showPageHtml() {
  return [
    '<html><head>',
    `<link rel="alternate" type="application/rss+xml" href="${FEED_URL}">`,
    '</head><body></body></html>',
  ].join('');
}

function feedXml(options: { matchingTitle: string }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:podcast="https://podcastindex.org/namespace/1.0">
  <channel>
    <title>TypeScript FM</title>
    <item>
      <title>Older TypeScript News</title>
      <guid>older-episode</guid>
      <pubDate>Mon, 01 Jul 2026 10:00:00 GMT</pubDate>
      <itunes:duration>00:42:00</itunes:duration>
      <enclosure url="https://cdn.example.com/older.mp3" type="audio/mpeg" />
    </item>
    <item>
      <title>${options.matchingTitle}</title>
      <guid isPermaLink="false">typescript-fm-74</guid>
      <pubDate>Wed, 22 Jul 2026 10:00:00 GMT</pubDate>
      <itunes:duration>01:02:03</itunes:duration>
      <enclosure url="https://cdn.example.com/typescript-fm-74.mp3" type="audio/mpeg" />
      <podcast:transcript url="https://cdn.example.com/typescript-fm-74.json" type="application/json" />
      <podcast:transcript url="https://cdn.example.com/typescript-fm-74.vtt" type="text/vtt" />
    </item>
  </channel>
</rss>`;
}

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  });
}

function textResponse(value: string) {
  return new Response(value, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
    status: 200,
  });
}

function stubPodcastFetch(options: { matchingTitle: string }) {
  const responses = new Map<string, Response>([
    [POCKET_CASTS_URL, textResponse(pocketCastsPageHtml())],
    [
      OEMBED_URL,
      jsonResponse({
        title: 'Announcing TypeScript 7, Bun 1.4 is in Rust | News | Ep 74 - TypeScript FM',
        author_name: 'TypeScript FM',
        author_url: SHOW_URL,
      }),
    ],
    [SHOW_URL, textResponse(showPageHtml())],
    [FEED_URL, textResponse(feedXml(options))],
  ]);
  const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const response = responses.get(url);
    if (!response) throw new Error(`Unexpected fetch: ${url}`);
    return response.clone();
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('podcast fetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('detects Pocket Casts episode URLs', () => {
    expect(isPocketCastsUrl(POCKET_CASTS_URL)).toBe(true);
    expect(isPocketCastsUrl('https://example.com/episode')).toBe(false);
  });

  it('resolves a Pocket Casts episode through oEmbed and matches the RSS item fixture', async () => {
    const fetchMock = stubPodcastFetch({
      matchingTitle: 'Announcing TypeScript 7, Bun 1.4 is in Rust | News | Ep 74',
    });

    const episode = await fetchPodcastEpisode(POCKET_CASTS_URL);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(episode).toMatchObject({
      podcastTitle: 'TypeScript FM',
      episodeTitle: 'Announcing TypeScript 7, Bun 1.4 is in Rust | News | Ep 74',
      episodeGuid: 'typescript-fm-74',
      feedUrl: FEED_URL,
      audioUrl: 'https://cdn.example.com/typescript-fm-74.mp3',
      audioMimeType: 'audio/mpeg',
      durationSeconds: 3723,
      rssTranscriptUrl: 'https://cdn.example.com/typescript-fm-74.vtt',
      rssTranscriptType: 'text/vtt',
    });
    expect(episode.publishedAt).toBe('2026-07-22T10:00:00.000Z');
  });

  it('rejects a feed when no item clears the matching threshold', async () => {
    stubPodcastFetch({ matchingTitle: 'A Completely Different Episode' });

    await expect(fetchPodcastEpisode(POCKET_CASTS_URL)).rejects.toThrow(
      'Could not confidently match episode',
    );
  });
});
