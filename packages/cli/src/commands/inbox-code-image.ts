import { routeLlmVision } from '@llaab/llm';

const VISION_MAX_TOKENS = 4096;

export const CODE_IMAGE_CONFIDENCE_THRESHOLD = 0.65;

interface CodeImageExtractionInput {
  description: string;
  imageBase64: string;
  mimeType: string;
}

export type CodeImageExtractionResult =
  | {
      ok: true;
      provider: string;
      model: string;
      result: CodeImageExtraction;
    }
  | { ok: false; error: string };

export interface CodeImageExtraction {
  is_code: boolean;
  language?: string;
  code: string;
  confidence: number;
}

export async function extractCodeFromImage(
  input: CodeImageExtractionInput,
): Promise<CodeImageExtractionResult> {
  const prompt = buildCodeImagePrompt(input.description);

  try {
    const llm = await routeLlmVision(
      prompt,
      { base64: input.imageBase64, mimeType: input.mimeType },
      { maxTokens: VISION_MAX_TOKENS },
    );
    const parsed = parseCodeImageExtraction(llm.text);
    if (!parsed) {
      return { ok: false, error: 'vision model returned invalid code extraction JSON' };
    }

    return { ok: true, provider: llm.provider, model: llm.model, result: parsed };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'vision extraction failed' };
  }
}

export function normalizeCodeLanguage(language: string | undefined): string | undefined {
  const normalized = language?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized === 'jsx' || normalized === 'react' || normalized === 'typescriptreact') {
    return 'tsx';
  }

  if (normalized === 'ts') {
    return 'typescript';
  }

  if (normalized === 'js') {
    return 'javascript';
  }

  return normalized;
}

function buildCodeImagePrompt(description: string): string {
  return [
    'Inspect this screenshot and extract source code only when the image clearly contains code.',
    'Return strict JSON only, with this shape:',
    '{"is_code": boolean, "language": string, "code": string, "confidence": number}',
    'Rules:',
    '- If it is not code, set is_code false, language empty, code empty, confidence 0-1.',
    '- Preserve indentation and line breaks.',
    '- Do not invent missing code hidden by cropping or blur.',
    '- Use "tsx" for JSX or TSX-looking code.',
    '- Prefer common lowercase language names such as typescript, tsx, javascript, astro, json, yaml, shell, sql, css, html.',
    `Description from sender: ${description || '(none)'}`,
  ].join('\n');
}

function parseCodeImageExtraction(text: string): CodeImageExtraction | undefined {
  const parsed = parseJsonObject(extractJsonObjectText(text) ?? text);
  if (!parsed) {
    return undefined;
  }

  const isCode = parsed['is_code'] === true;
  const code = typeof parsed['code'] === 'string' ? parsed['code'].trim() : '';
  const confidence =
    typeof parsed['confidence'] === 'number' ? parsed['confidence'] : isCode && code ? 0.7 : 0;

  return {
    is_code: isCode,
    language: normalizeCodeLanguage(typeof parsed['language'] === 'string' ? parsed['language'] : undefined),
    code,
    confidence: Math.max(0, Math.min(1, confidence)),
  };
}

function extractJsonObjectText(text: string): string | undefined {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start >= 0 && end > start ? text.slice(start, end + 1) : undefined;
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
