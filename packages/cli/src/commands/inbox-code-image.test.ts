import { beforeEach, describe, expect, it, vi } from 'vitest';

const { routeLlmVision } = vi.hoisted(() => ({ routeLlmVision: vi.fn() }));
vi.mock('@llaab/llm', () => ({ routeLlmVision }));

describe('extractCodeFromImage', () => {
  beforeEach(() => {
    routeLlmVision.mockReset();
  });

  it('delegates code-image extraction to the shared vision route', async () => {
    routeLlmVision.mockResolvedValueOnce({
      text: JSON.stringify({
        is_code: true,
        language: 'react',
        code: 'const value = 1;',
        confidence: 0.9,
      }),
      model: 'vision-model',
      provider: 'lmstudio',
      cached: false,
      durationMs: 10,
    });

    const { extractCodeFromImage } = await import('./inbox-code-image.js');
    const result = await extractCodeFromImage({
      description: 'screenshot from Telegram',
      imageBase64: 'image-base64',
      mimeType: 'image/png',
    });

    expect(routeLlmVision).toHaveBeenCalledWith(
      expect.stringContaining('Description from sender: screenshot from Telegram'),
      { base64: 'image-base64', mimeType: 'image/png' },
      { maxTokens: 4096 },
    );
    expect(result).toEqual({
      ok: true,
      provider: 'lmstudio',
      model: 'vision-model',
      result: {
        is_code: true,
        language: 'tsx',
        code: 'const value = 1;',
        confidence: 0.9,
      },
    });
  });

  it('keeps invalid vision JSON as a failed extraction result', async () => {
    routeLlmVision.mockResolvedValueOnce({
      text: 'not json',
      model: 'vision-model',
      provider: 'ollama',
      cached: false,
      durationMs: 10,
    });

    const { extractCodeFromImage } = await import('./inbox-code-image.js');
    const result = await extractCodeFromImage({
      description: '',
      imageBase64: 'image-base64',
      mimeType: 'image/png',
    });

    expect(result).toEqual({ ok: false, error: 'vision model returned invalid code extraction JSON' });
  });
});
