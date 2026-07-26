import { beforeEach, describe, expect, it, vi } from 'vitest';

const { routeLlmVisionObject } = vi.hoisted(() => ({ routeLlmVisionObject: vi.fn() }));
vi.mock('@llaab/llm', () => ({ routeLlmVisionObject }));

describe('extractCodeFromImage', () => {
  beforeEach(() => {
    routeLlmVisionObject.mockReset();
  });

  it('delegates code-image extraction to the shared vision route', async () => {
    routeLlmVisionObject.mockResolvedValueOnce({
      object: {
        is_code: true,
        language: 'react',
        code: 'const value = 1;',
        confidence: 0.9,
      },
      rawText: '{"is_code":true}',
      model: 'vision-model',
      provider: 'lmstudio',
      durationMs: 10,
    });

    const { extractCodeFromImage } = await import('./inbox-code-image.js');
    const result = await extractCodeFromImage({
      description: 'screenshot from Telegram',
      imageBase64: 'image-base64',
      mimeType: 'image/png',
    });

    expect(routeLlmVisionObject).toHaveBeenCalledWith(
      expect.stringContaining('Description from sender: screenshot from Telegram'),
      { base64: 'image-base64', mimeType: 'image/png' },
      expect.any(Object),
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

  it('keeps non-code image output as a successful low-confidence result', async () => {
    routeLlmVisionObject.mockResolvedValueOnce({
      object: {
        is_code: false,
        language: '',
        code: '',
        confidence: 0.1,
      },
      rawText: '{"is_code":false}',
      model: 'vision-model',
      provider: 'ollama',
      durationMs: 10,
    });

    const { extractCodeFromImage } = await import('./inbox-code-image.js');
    const result = await extractCodeFromImage({
      description: 'vacation photo',
      imageBase64: 'image-base64',
      mimeType: 'image/png',
    });

    expect(result).toEqual({
      ok: true,
      provider: 'ollama',
      model: 'vision-model',
      result: {
        is_code: false,
        language: undefined,
        code: '',
        confidence: 0.1,
      },
    });
  });

  it('preserves low confidence code output for the caller threshold', async () => {
    routeLlmVisionObject.mockResolvedValueOnce({
      object: {
        is_code: true,
        language: 'typescript',
        code: 'const maybe = 1;',
        confidence: 0.4,
      },
      rawText: '{"is_code":true}',
      model: 'vision-model',
      provider: 'ollama',
      durationMs: 10,
    });

    const { extractCodeFromImage } = await import('./inbox-code-image.js');
    const result = await extractCodeFromImage({
      description: '',
      imageBase64: 'image-base64',
      mimeType: 'image/png',
    });

    expect(result).toEqual({
      ok: true,
      provider: 'ollama',
      model: 'vision-model',
      result: {
        is_code: true,
        language: 'typescript',
        code: 'const maybe = 1;',
        confidence: 0.4,
      },
    });
  });

  it('defaults missing confidence for schema-valid legacy provider output', async () => {
    routeLlmVisionObject.mockResolvedValueOnce({
      object: {
        is_code: true,
        language: 'ts',
        code: 'const legacy = true;',
      },
      rawText: '{"is_code":true}',
      model: 'vision-model',
      provider: 'ollama',
      durationMs: 10,
    });

    const { extractCodeFromImage } = await import('./inbox-code-image.js');
    const result = await extractCodeFromImage({
      description: '',
      imageBase64: 'image-base64',
      mimeType: 'image/png',
    });

    expect(result).toEqual({
      ok: true,
      provider: 'ollama',
      model: 'vision-model',
      result: {
        is_code: true,
        language: 'typescript',
        code: 'const legacy = true;',
        confidence: 0.7,
      },
    });
  });

  it('keeps malformed vision output as a failed extraction result', async () => {
    routeLlmVisionObject.mockRejectedValueOnce(new Error('No JSON object found in model output'));

    const { extractCodeFromImage } = await import('./inbox-code-image.js');
    const result = await extractCodeFromImage({
      description: '',
      imageBase64: 'image-base64',
      mimeType: 'image/png',
    });

    expect(result).toEqual({ ok: false, error: 'No JSON object found in model output' });
  });
});
