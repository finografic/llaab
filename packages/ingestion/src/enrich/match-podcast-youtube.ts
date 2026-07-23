import type { SourceNode } from '@llaab/schemas';

import { searchYouTubeChannelsByTitle, searchYouTubeVideosByChannel } from '../fetch/youtube-data-api.js';
import { titleSimilarity } from '../utils/title-similarity.js';

export type YouTubeMatchBasis = 'vault' | 'website' | 'search';

export interface PodcastYouTubeMatch {
  url: string;
  channelId?: string;
  confidence: number;
  basis: YouTubeMatchBasis;
}

/** Vault matches are free and already-vetted (the user ingested from this channel before). */
const VAULT_MATCH_MIN_SIMILARITY = 0.6;
/** Above this, a vault match is confident enough to skip the network-based levels entirely. */
const VAULT_MATCH_SKIP_THRESHOLD = 0.8;
const SEARCH_MATCH_MIN_SIMILARITY = 0.6;

function isYouTubeChannelSource(source: SourceNode): boolean {
  return source.platforms.includes('youtube') && source.source_kind === 'channel';
}

function isPodcastSource(source: SourceNode): boolean {
  return source.platforms.includes('rss') && source.source_kind === 'publication';
}

function hasLinkedYouTubeProfile(source: SourceNode): boolean {
  return source.profiles.some((profile) => profile.platform === 'youtube');
}

/**
 * Level A — an already-ingested YouTube channel source with a similar title or handle, no
 * network calls. The handle check matters: platform handles (e.g. `@TypeScript-fm`) often carry
 * the show's name in a form closer to the podcast title than the channel's display title does.
 */
function matchFromVault(source: SourceNode, allSources: SourceNode[]): PodcastYouTubeMatch | undefined {
  let best: { channel: SourceNode; similarity: number } | undefined;

  for (const candidate of allSources) {
    if (candidate.id === source.id || !isYouTubeChannelSource(candidate)) continue;

    const titleScore = titleSimilarity(source.title, candidate.title);
    const handleScore = candidate.handle
      ? titleSimilarity(source.title, candidate.handle.replace(/^@/, ''))
      : 0;
    const similarity = Math.max(titleScore, handleScore);

    if (!best || similarity > best.similarity) best = { channel: candidate, similarity };
  }

  if (!best || best.similarity < VAULT_MATCH_MIN_SIMILARITY || !best.channel.url) return undefined;

  return {
    url: best.channel.url,
    channelId: best.channel.platform_id,
    confidence: Math.round(best.similarity * 100),
    basis: 'vault',
  };
}

const YOUTUBE_LINK_PATTERN =
  /https?:\/\/(?:www\.)?youtube\.com\/(?:channel\/[\w-]+|@[\w.-]+|c\/[\w.-]+|user\/[\w.-]+)/i;

/** Level B — the podcast's own website often links out to its YouTube channel directly. */
async function matchFromWebsite(source: SourceNode): Promise<PodcastYouTubeMatch | undefined> {
  const website = source.profiles.find((profile) => profile.platform === 'website')?.url;
  if (!website) return undefined;

  try {
    const response = await fetch(website);
    if (!response.ok) return undefined;
    const html = await response.text();
    const match = html.match(YOUTUBE_LINK_PATTERN)?.[0];
    if (!match) return undefined;

    return { url: match, confidence: 90, basis: 'website' };
  } catch {
    return undefined;
  }
}

/** Level C — YouTube Data API search by podcast title, scored the same way as episode matching. */
async function matchFromSearch(source: SourceNode): Promise<PodcastYouTubeMatch | undefined> {
  const results = await searchYouTubeChannelsByTitle(source.title);

  let best: { result: (typeof results)[number]; similarity: number } | undefined;
  for (const result of results) {
    const similarity = titleSimilarity(source.title, result.title);
    if (!best || similarity > best.similarity) best = { result, similarity };
  }

  if (!best || best.similarity < SEARCH_MATCH_MIN_SIMILARITY) return undefined;

  return {
    url: best.result.channel_url,
    channelId: best.result.channel_id,
    confidence: Math.round(best.similarity * 100),
    basis: 'search',
  };
}

/**
 * Finds a likely YouTube channel for a podcast source, without any LLM involved — pure title
 * similarity and link scraping, mirroring the confidence-scoring approach already used for
 * matching podcast episodes against RSS feed items (see fetch/podcast.ts).
 *
 * Tries progressively more expensive levels and keeps the best result across all of them:
 * an already-known vault channel first (free, pre-vetted by the user), then the podcast's own
 * website (one fetch), then a YouTube Data API search (costs quota). A strong vault match skips
 * the network levels entirely.
 */
export async function matchPodcastYouTubeChannel(
  source: SourceNode,
  allSources: SourceNode[],
): Promise<PodcastYouTubeMatch | undefined> {
  if (!isPodcastSource(source) || hasLinkedYouTubeProfile(source)) return undefined;

  const vaultMatch = matchFromVault(source, allSources);
  if (vaultMatch && vaultMatch.confidence / 100 >= VAULT_MATCH_SKIP_THRESHOLD) return vaultMatch;

  const [websiteMatch, searchMatch] = await Promise.all([
    matchFromWebsite(source),
    matchFromSearch(source).catch(() => undefined),
  ]);

  const candidates = [vaultMatch, websiteMatch, searchMatch].filter(
    (candidate): candidate is PodcastYouTubeMatch => candidate != null,
  );
  if (candidates.length === 0) return undefined;

  return candidates.reduce((best, candidate) => (candidate.confidence > best.confidence ? candidate : best));
}

/** Above this, a channel match is trusted enough to search it for a specific episode upload. */
const YOUTUBE_TRUST_MIN_CONFIDENCE = 80;
const EPISODE_MATCH_MIN_SIMILARITY = 0.6;
/** Small nudge for a video published close to the episode's RSS `pubDate` — breaks title ties. */
const EPISODE_DATE_BONUS_CLOSE = 0.1;
const EPISODE_DATE_BONUS_NEAR = 0.05;

function channelIdFromUrl(url: string): string | undefined {
  return url.match(/youtube\.com\/channel\/([\w-]+)/i)?.[1];
}

/**
 * A channel id worth trusting for episode-level lookups — either a user-confirmed `youtube`
 * profile or a high-confidence match. A wrong channel here means fetching the wrong episode's
 * transcript entirely, so this deliberately requires more certainty than the channel match itself.
 */
export function resolveTrustedYouTubeChannelId(source: SourceNode): string | undefined {
  const confirmedUrl = source.profiles.find((profile) => profile.platform === 'youtube')?.url;
  const confirmedChannelId = confirmedUrl ? channelIdFromUrl(confirmedUrl) : undefined;
  if (confirmedChannelId) return confirmedChannelId;

  if (
    source.youtube_match_channel_id &&
    (source.youtube_match_confidence ?? 0) >= YOUTUBE_TRUST_MIN_CONFIDENCE
  ) {
    return source.youtube_match_channel_id;
  }

  return undefined;
}

function dateProximityBonus(episodePublishedAt?: string, videoPublishedAt?: string): number {
  if (!episodePublishedAt || !videoPublishedAt) return 0;
  const episodeMs = Date.parse(episodePublishedAt);
  const videoMs = Date.parse(videoPublishedAt);
  if (!Number.isFinite(episodeMs) || !Number.isFinite(videoMs)) return 0;

  const diffDays = Math.abs(episodeMs - videoMs) / (24 * 60 * 60 * 1000);
  if (diffDays <= 3) return EPISODE_DATE_BONUS_CLOSE;
  if (diffDays <= 7) return EPISODE_DATE_BONUS_NEAR;
  return 0;
}

export interface PodcastEpisodeYouTubeMatch {
  videoUrl: string;
  videoId: string;
  confidence: number;
}

/**
 * Finds a podcast episode's matching upload on an already-trusted YouTube channel, by title
 * similarity plus a small publish-date bonus. Lets podcast ingestion prefer YouTube's own
 * captions over a full local mlx-whisper transcription — far faster, at the cost of caption
 * quality and match risk, hence the confidence gate.
 */
export async function matchPodcastEpisodeOnYouTube(
  channelId: string,
  episodeTitle: string,
  episodePublishedAt?: string,
): Promise<PodcastEpisodeYouTubeMatch | undefined> {
  const results = await searchYouTubeVideosByChannel(channelId, episodeTitle);

  let best: { result: (typeof results)[number]; score: number } | undefined;
  for (const result of results) {
    const score =
      titleSimilarity(episodeTitle, result.title) +
      dateProximityBonus(episodePublishedAt, result.published_at);
    if (!best || score > best.score) best = { result, score };
  }

  if (!best || best.score < EPISODE_MATCH_MIN_SIMILARITY) return undefined;

  return {
    videoUrl: best.result.video_url,
    videoId: best.result.video_id,
    confidence: Math.round(Math.min(best.score, 1) * 100),
  };
}
