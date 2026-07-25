import { writeFileSync } from 'node:fs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { execFileSync } = vi.hoisted(() => ({
  execFileSync: vi.fn(),
}));

vi.mock('child_process', () => ({ execFileSync }));

describe('transcribeAudioLocally', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'llaab-mlx-whisper-'));
    process.env.LLAAB_VAULT = join(root, 'vault');
    process.env.LLAAB_MLX_WHISPER_MODEL = 'mlx-community/whisper-tiny';
    execFileSync.mockReset();
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.LLAAB_VAULT;
    delete process.env.LLAAB_MLX_WHISPER_MODEL;
    vi.unstubAllGlobals();
    await rm(root, { force: true, recursive: true });
  });

  it('retries http audio downloads as https before normalizing and transcribing', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('terminated'))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    execFileSync.mockImplementation((command: string, args: string[]) => {
      if (command === 'ffmpeg') {
        return undefined;
      }
      const normalizedPath = args[0]!;
      const outputDir = args[args.indexOf('--output-dir') + 1]!;
      const jsonPath = join(
        outputDir,
        `${normalizedPath
          .split('/')
          .pop()!
          .replace(/\.wav$/, '')}.json`,
      );
      writeFileSync(
        jsonPath,
        JSON.stringify({
          text: 'Transcribed from retried audio.',
          segments: [{ start: 0, end: 1, text: 'Transcribed from retried audio.' }],
        }),
      );
      return undefined;
    });

    const { transcribeAudioLocally } = await import('./mlx-whisper.js');
    const result = await transcribeAudioLocally('http://cdn.example.com/audio.mp3');

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://cdn.example.com/audio.mp3');
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://cdn.example.com/audio.mp3');
    expect(execFileSync).toHaveBeenCalledWith(
      'mlx_whisper',
      expect.arrayContaining(['--model', 'mlx-community/whisper-tiny']),
      { stdio: 'pipe' },
    );
    expect(result.plainText).toBe('Transcribed from retried audio.');
    await expect(readdir(join(process.env.LLAAB_VAULT!, '.tmp'))).resolves.toEqual([]);
  });
});
