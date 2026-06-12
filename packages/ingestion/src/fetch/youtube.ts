import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { VAULT_ROOT } from '@llaab/core';
import { formatIsoUtcForTranscriptBody } from '@llaab/schemas';

const TEMP_DIR = join(VAULT_ROOT, '.tmp');

export interface CapturedYouTubeUrl {
  url: string;
  videoId: string;
}

export interface FetchedYouTubeTranscript {
  title: string;
  channel: string;
  channelId?: string;
  description: string;
  rawTranscript: string;
  duration: number;
  uploadDate: string;
  /** Channel or uploader page URL from yt-dlp when present. */
  channelUrl?: string;
  channelVerified?: boolean;
  channelSubscriberCount?: number;
  /**
   * UTC display string for transcript header (`YYYY-MM-DD HH:mm:ss`), from upload timestamp or date-only
   * fallback.
   */
  uploadedDisplay?: string;
}

function channelUrlFromMetadata(metadata: Record<string, unknown>): string | undefined {
  const u = metadata.uploader_url;
  const c = metadata.channel_url;
  if (typeof u === 'string' && u.startsWith('http')) return u;
  if (typeof c === 'string' && c.startsWith('http')) return c;
  return undefined;
}

function uploadedDisplayFromMetadata(
  metadata: Record<string, unknown>,
  uploadDate: string,
): string | undefined {
  const ts = metadata.timestamp;
  if (typeof ts === 'number' && Number.isFinite(ts)) {
    return formatIsoUtcForTranscriptBody(new Date(ts * 1000).toISOString());
  }
  if (uploadDate.length === 8 && /^\d{8}$/.test(uploadDate)) {
    return `${uploadDate.slice(0, 4)}-${uploadDate.slice(4, 6)}-${uploadDate.slice(6, 8)} 00:00:00`;
  }
  return undefined;
}

export function parseYouTubeUrl(input: string): CapturedYouTubeUrl {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      return {
        url: `https://www.youtube.com/watch?v=${match[1]}`,
        videoId: match[1],
      };
    }
  }

  throw new Error(`Could not extract YouTube video ID from: ${input}`);
}

export async function fetchYouTube(url: string): Promise<FetchedYouTubeTranscript> {
  const captured = parseYouTubeUrl(url);

  if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true });
  }

  const outBase = join(TEMP_DIR, captured.videoId);

  try {
    execSync(`yt-dlp --skip-download --print-json --no-warnings "${captured.url}" > "${outBase}.json"`, {
      stdio: 'pipe',
    });
  } catch (error) {
    throw new Error(
      `Failed to fetch YouTube metadata. Install yt-dlp and retry.\n${(error as Error).message}`,
    );
  }

  const metadata = JSON.parse(readFileSync(`${outBase}.json`, 'utf-8')) as Record<string, unknown>;

  /**
   * --convert-format srt Subtitle format; single format, formats preference separated by "/", or
   * "ass/srt/best"
   *
   * --convert-subs srt currently supported: ass, lrc, srt, vtt (single) disable: none (default)
   */
  try {
    execSync(
      `yt-dlp --skip-download --write-auto-subs --sub-langs en --sub-format "vtt/best" -o "${outBase}" "${captured.url}"`,
      { stdio: 'pipe' },
    );
  } catch {
    // Some videos do not have subtitles. The pipeline stores metadata anyway.
  }

  let rawTranscript = '';
  for (const ext of ['.en.vtt', '.en.srt']) {
    const subtitleFile = `${outBase}${ext}`;
    if (existsSync(subtitleFile)) {
      rawTranscript = readFileSync(subtitleFile, 'utf-8');
      break;
    }
  }

  const uploadDate = typeof metadata.upload_date === 'string' ? metadata.upload_date : '';

  return {
    title: typeof metadata.title === 'string' ? metadata.title : 'Untitled',
    channel:
      typeof metadata.channel === 'string'
        ? metadata.channel
        : typeof metadata.uploader === 'string'
          ? metadata.uploader
          : 'Unknown',
    channelId: typeof metadata.channel_id === 'string' ? metadata.channel_id : undefined,
    description: typeof metadata.description === 'string' ? metadata.description.slice(0, 2_000) : '',
    rawTranscript,
    duration: typeof metadata.duration === 'number' ? metadata.duration : 0,
    uploadDate,
    channelUrl: channelUrlFromMetadata(metadata),
    channelVerified: metadata.channel_is_verified === true ? true : undefined,
    channelSubscriberCount:
      typeof metadata.channel_follower_count === 'number' ? metadata.channel_follower_count : undefined,
    uploadedDisplay: uploadedDisplayFromMetadata(metadata, uploadDate),
  };
}
