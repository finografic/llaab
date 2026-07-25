function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export interface YouTubeDataApiChannelStats {
  subscriber_count?: number;
  video_count?: number;
  verified?: boolean;
}

interface YouTubeChannelsResponse {
  items?: Array<{
    statistics?: {
      subscriberCount?: string;
      videoCount?: string;
    };
    status?: {
      isLinked?: boolean;
    };
    snippet?: {
      title?: string;
    };
  }>;
  error?: { message?: string };
}

function parseCount(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Optional enrichment via YouTube Data API when `YOUTUBE_API_KEY` is configured.
 * Improves counts that yt-dlp tab extraction cannot provide reliably (e.g. total video count).
 */
export async function fetchYouTubeDataApiChannelStats(
  channelId: string,
): Promise<YouTubeDataApiChannelStats | undefined> {
  const apiKey = readEnv('YOUTUBE_API_KEY');
  if (!apiKey || !channelId.startsWith('UC')) {
    return undefined;
  }

  const query = new URLSearchParams({
    part: 'statistics,status',
    id: channelId,
    key: apiKey,
  });

  const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?${query.toString()}`);
  const json = (await response.json()) as YouTubeChannelsResponse;
  if (!response.ok) {
    throw new Error(json.error?.message ?? `YouTube channels lookup failed (${response.status}).`);
  }

  const item = json.items?.[0];
  if (!item) {
    return undefined;
  }

  return {
    subscriber_count: parseCount(item.statistics?.subscriberCount),
    video_count: parseCount(item.statistics?.videoCount),
    verified: item.status?.isLinked,
  };
}

export interface YouTubeChannelSearchResult {
  channel_id: string;
  title: string;
  channel_url: string;
}

interface YouTubeSearchResponse {
  items?: Array<{
    id?: { channelId?: string };
    snippet?: { title?: string; channelTitle?: string };
  }>;
  error?: { message?: string };
}

/**
 * Searches YouTube channels by name via the Data API's `search.list` — used to find a podcast's
 * YouTube channel by title similarity when no direct link is available elsewhere. Requires
 * `YOUTUBE_API_KEY`; returns an empty array (not an error) when the key isn't configured, since
 * callers treat this as an optional enrichment signal.
 */
export async function searchYouTubeChannelsByTitle(query: string): Promise<YouTubeChannelSearchResult[]> {
  const apiKey = readEnv('YOUTUBE_API_KEY');
  if (!apiKey || !query.trim()) return [];

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'channel',
    maxResults: '5',
    q: query,
    key: apiKey,
  });

  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
  const json = (await response.json()) as YouTubeSearchResponse;
  if (!response.ok) {
    throw new Error(json.error?.message ?? `YouTube channel search failed (${response.status}).`);
  }

  return (json.items ?? [])
    .filter(
      (item): item is { id: { channelId: string }; snippet?: { title?: string; channelTitle?: string } } =>
        Boolean(item.id?.channelId),
    )
    .map((item) => ({
      channel_id: item.id.channelId,
      title: item.snippet?.channelTitle ?? item.snippet?.title ?? 'Unknown channel',
      channel_url: `https://www.youtube.com/channel/${item.id.channelId}`,
    }));
}

export interface YouTubeVideoSearchResult {
  video_id: string;
  title: string;
  video_url: string;
  published_at?: string;
}

interface YouTubeVideoSearchResponse {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: { title?: string; publishedAt?: string };
  }>;
  error?: { message?: string };
}

/**
 * Searches a specific channel's uploads by title via the Data API's `search.list` — used to find
 * the YouTube upload of a podcast episode already known to be on that channel. Requires
 * `YOUTUBE_API_KEY`; returns an empty array (not an error) when the key isn't configured.
 */
export async function searchYouTubeVideosByChannel(
  channelId: string,
  query: string,
): Promise<YouTubeVideoSearchResult[]> {
  const apiKey = readEnv('YOUTUBE_API_KEY');
  if (!apiKey || !query.trim()) return [];

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    channelId,
    order: 'relevance',
    maxResults: '5',
    q: query,
    key: apiKey,
  });

  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
  const json = (await response.json()) as YouTubeVideoSearchResponse;
  if (!response.ok) {
    throw new Error(json.error?.message ?? `YouTube video search failed (${response.status}).`);
  }

  return (json.items ?? [])
    .filter((item): item is { id: { videoId: string }; snippet?: { title?: string; publishedAt?: string } } =>
      Boolean(item.id?.videoId),
    )
    .map((item) => ({
      video_id: item.id.videoId,
      title: item.snippet?.title ?? 'Untitled video',
      video_url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      published_at: item.snippet?.publishedAt,
    }));
}
