import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

const VAULT_ROOT = process.env.LLAAB_VAULT || './vault';
const TEMP_DIR = join(VAULT_ROOT, '.tmp');

export interface CapturedYouTubeUrl {
  url: string;
  videoId: string;
}

export interface FetchedYouTubeTranscript {
  title: string;
  channel: string;
  description: string;
  rawTranscript: string;
  duration: number;
  uploadDate: string;
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
   *
   * --convert-format srt
   *     Subtitle format; single format, formats preference
   *     separated by "/", or "ass/srt/best"
   *
   * --convert-subs srt
   *     currently supported: ass, lrc, srt, vtt (single)
   *     disable: none (default)
   *
   */
  try {
    execSync(
      // `yt-dlp --skip-download --write-auto-subs --sub-langs en --sub-format vtt --convert-subs srt -o "${outBase}" "${captured.url}"`,
      `yt-dlp --skip-download --write-auto-subs --sub-langs en --sub-format srt --convert-subs vtt -o "${outBase}" "${captured.url}"`,
      { stdio: 'pipe' },
    );
  } catch {
    // Some videos do not have subtitles. The pipeline stores metadata anyway.
  }

  let rawTranscript = '';
  for (const subtitleFile of [`${outBase}.en.srt`, `${outBase}.en.vtt`]) {
    if (existsSync(subtitleFile)) {
      rawTranscript = readFileSync(subtitleFile, 'utf-8');
      break;
    }
  }

  return {
    title: typeof metadata.title === 'string' ? metadata.title : 'Untitled',
    channel:
      typeof metadata.channel === 'string'
        ? metadata.channel
        : typeof metadata.uploader === 'string'
          ? metadata.uploader
          : 'Unknown',
    description: typeof metadata.description === 'string' ? metadata.description.slice(0, 2_000) : '',
    rawTranscript,
    duration: typeof metadata.duration === 'number' ? metadata.duration : 0,
    uploadDate: typeof metadata.upload_date === 'string' ? metadata.upload_date : '',
  };
}
