import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { VAULT_ROOT } from '@llaab/core';

import { fetchYouTubeDataApiChannelStats } from './youtube-data-api.js';

const TEMP_DIR = join(VAULT_ROOT, '.tmp');

export interface YouTubeChannelMetadata {
  channel_id: string;
  title: string;
  handle?: string;
  description: string;
  avatar_url?: string;
  subscriber_count?: number;
  video_count?: number;
  verified?: boolean;
  tags: string[];
  channel_url: string;
}

interface YtDlpThumbnail {
  url?: string;
  width?: number;
  height?: number;
  preference?: number;
}

function ensureTempDir(): void {
  if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true });
  }
}

function runYtDlpJson(args: string, cacheKey: string): Record<string, unknown> {
  ensureTempDir();
  const cacheFile = join(TEMP_DIR, `${cacheKey}.json`);

  const command = `yt-dlp ${args} > "${cacheFile}"`;
  try {
    execSync(command, { stdio: 'pipe' });
  } catch (error) {
    throw new Error(
      `Failed to fetch YouTube channel metadata. Install yt-dlp and retry.\n${(error as Error).message}`,
    );
  }

  return JSON.parse(readFileSync(cacheFile, 'utf-8')) as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === 'boolean' ? value : undefined;
}

function pickAvatarUrl(thumbnails: unknown): string | undefined {
  if (!Array.isArray(thumbnails)) return undefined;

  const candidates = thumbnails.filter(
    (item): item is YtDlpThumbnail =>
      typeof item === 'object' && item !== null && typeof (item as YtDlpThumbnail).url === 'string',
  );

  if (candidates.length === 0) return undefined;

  candidates.sort((left, right) => {
    const leftScore = (left.preference ?? 0) * 10_000 + (left.width ?? 0);
    const rightScore = (right.preference ?? 0) * 10_000 + (right.width ?? 0);
    return rightScore - leftScore;
  });

  return candidates[0]?.url;
}

function normalizeChannelUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.includes('/channel/') || trimmed.includes('/@')) {
    return trimmed.replace(/\/(videos|streams|shorts|playlists|community|about|featured)\/?$/, '');
  }
  return trimmed;
}

function cacheKeyForUrl(url: string): string {
  return `yt-channel-${Buffer.from(url).toString('base64url').slice(0, 48)}`;
}

export function formatAudienceCount(count: number): string {
  if (count >= 1_000_000) {
    const millions = count / 1_000_000;
    return `${millions >= 10 ? Math.round(millions) : millions.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1_000) {
    const thousands = count / 1_000;
    return `${thousands >= 10 ? Math.round(thousands) : thousands.toFixed(1).replace(/\.0$/, '')}K`;
  }
  return count.toLocaleString('en-US');
}

export async function fetchYouTubeChannel(channelUrl: string): Promise<YouTubeChannelMetadata> {
  const normalizedUrl = normalizeChannelUrl(channelUrl);
  const cacheKey = cacheKeyForUrl(normalizedUrl);

  const channelRecord = runYtDlpJson(
    `--dump-single-json --playlist-items 0 --no-warnings "${normalizedUrl}"`,
    `${cacheKey}-tab`,
  );

  let verified = readBoolean(channelRecord, 'channel_is_verified');
  if (verified === undefined) {
    try {
      const latestVideo = runYtDlpJson(
        `--dump-single-json --playlist-items 1 --no-warnings "${normalizedUrl}/videos"`,
        `${cacheKey}-latest`,
      );
      verified = readBoolean(latestVideo, 'channel_is_verified');
    } catch {
      verified = undefined;
    }
  }

  const channelId = readString(channelRecord, 'channel_id') ?? readString(channelRecord, 'id') ?? '';
  const title =
    readString(channelRecord, 'channel') ??
    readString(channelRecord, 'title') ??
    readString(channelRecord, 'uploader') ??
    'Unknown channel';

  const handle = readString(channelRecord, 'uploader_id');
  const description = readString(channelRecord, 'description') ?? '';
  const avatarUrl = pickAvatarUrl(channelRecord.thumbnails);
  let subscriberCount = readNumber(channelRecord, 'channel_follower_count');
  let videoCount: number | undefined;
  const tags = Array.isArray(channelRecord.tags)
    ? channelRecord.tags.filter((tag): tag is string => typeof tag === 'string')
    : [];

  const resolvedChannelUrl =
    readString(channelRecord, 'channel_url') ??
    readString(channelRecord, 'uploader_url') ??
    readString(channelRecord, 'webpage_url') ??
    normalizedUrl;

  if (channelId) {
    try {
      const apiStats = await fetchYouTubeDataApiChannelStats(channelId);
      if (apiStats) {
        subscriberCount = apiStats.subscriber_count ?? subscriberCount;
        videoCount = apiStats.video_count;
        verified = apiStats.verified ?? verified;
      }
    } catch {
      // Public yt-dlp metadata is still useful when the API is unavailable.
    }
  }

  return {
    channel_id: channelId,
    title,
    handle,
    description,
    avatar_url: avatarUrl,
    subscriber_count: subscriberCount,
    video_count: videoCount,
    verified,
    tags,
    channel_url: resolvedChannelUrl,
  };
}
