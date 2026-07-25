import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { VAULT_ROOT } from '@llaab/core';

// Resolved lazily (not at module load) so importing this module doesn't require VAULT_ROOT to be
// available yet — matters for test setups that mock `@llaab/core` without every export.
function tempDir(): string {
  return join(VAULT_ROOT, '.tmp');
}

export interface TranscribedSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscribedAudio {
  plainText: string;
  segments?: TranscribedSegment[];
}

interface MlxWhisperJson {
  text?: string;
  segments?: Array<{ start?: number; end?: number; text?: string }>;
}

async function fetchAudio(audioUrl: string): Promise<Response> {
  try {
    return await fetch(audioUrl);
  } catch (error) {
    const parsed = new URL(audioUrl);
    if (parsed.protocol !== 'http:') throw error;
    parsed.protocol = 'https:';
    return fetch(parsed.toString());
  }
}

/**
 * Downloads a podcast episode's audio and transcribes it locally with mlx-whisper (Apple
 * Silicon-native, runs on the same Mac Studio as LM Studio — no cloud STT dependency).
 * Requires `mlx-whisper` (`pip install mlx-whisper`) and `ffmpeg` on PATH.
 */
export async function transcribeAudioLocally(
  audioUrl: string,
  opts: { model?: string } = {},
): Promise<TranscribedAudio> {
  const model = opts.model ?? process.env.LLAAB_MLX_WHISPER_MODEL ?? 'mlx-community/whisper-large-v3-turbo';
  const TEMP_DIR = tempDir();

  if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true });
  }

  const scratchBase = join(TEMP_DIR, `podcast-${randomUUID()}`);
  const rawAudioPath = `${scratchBase}.audio`;
  const normalizedPath = `${scratchBase}.wav`;

  try {
    const response = await fetchAudio(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to download episode audio (HTTP ${response.status}): ${audioUrl}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    await import('fs/promises').then(({ writeFile }) => writeFile(rawAudioPath, buffer));

    try {
      execFileSync('ffmpeg', ['-y', '-i', rawAudioPath, '-ar', '16000', '-ac', '1', normalizedPath], {
        stdio: 'pipe',
      });
    } catch (error) {
      throw new Error(
        `ffmpeg failed to normalize episode audio. Ensure ffmpeg is installed and on PATH.\n${(error as Error).message}`,
      );
    }

    try {
      execFileSync(
        'mlx_whisper',
        [
          normalizedPath,
          '--model',
          model,
          '--output-format',
          'json',
          '--output-dir',
          TEMP_DIR,
          '--verbose',
          'False',
        ],
        { stdio: 'pipe' },
      );
    } catch (error) {
      throw new Error(
        'mlx_whisper failed. Install it with `pip install mlx-whisper` and ensure it is on PATH.\n' +
          `${(error as Error).message}`,
      );
    }

    const jsonPath = `${normalizedPath.replace(/\.wav$/, '')}.json`;
    const parsed = JSON.parse(readFileSync(jsonPath, 'utf-8')) as MlxWhisperJson;

    const segments: TranscribedSegment[] | undefined = parsed.segments
      ?.filter((segment) => segment.text !== undefined)
      .map((segment) => ({
        start: segment.start ?? 0,
        end: segment.end ?? 0,
        text: (segment.text ?? '').trim(),
      }));

    return {
      plainText: (parsed.text ?? segments?.map((s) => s.text).join(' ') ?? '').trim(),
      segments,
    };
  } finally {
    for (const path of [rawAudioPath, normalizedPath, `${normalizedPath.replace(/\.wav$/, '')}.json`]) {
      if (existsSync(path)) rmSync(path, { force: true });
    }
  }
}
