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

  const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?${query}`);
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
