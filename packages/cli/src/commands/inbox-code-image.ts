import { routeLlmVisionObject } from '@llaab/llm';
import { z } from 'zod';

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

const CodeImageExtractionSchema = z.object({
  is_code: z.boolean(),
  language: z.string().optional(),
  code: z.string(),
  confidence: z.number().min(0).max(1).optional(),
});

export async function extractCodeFromImage(
  input: CodeImageExtractionInput,
): Promise<CodeImageExtractionResult> {
  const prompt = buildCodeImagePrompt(input.description);

  try {
    const llm = await routeLlmVisionObject(
      prompt,
      { base64: input.imageBase64, mimeType: input.mimeType },
      CodeImageExtractionSchema,
      { maxTokens: VISION_MAX_TOKENS },
    );

    return {
      ok: true,
      provider: llm.provider,
      model: llm.model,
      result: normalizeCodeImageExtraction(llm.object),
    };
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

function normalizeCodeImageExtraction(
  parsed: z.infer<typeof CodeImageExtractionSchema>,
): CodeImageExtraction {
  const code = parsed.code.trim();
  return {
    is_code: parsed.is_code,
    language: normalizeCodeLanguage(parsed.language),
    code,
    confidence: parsed.confidence ?? (parsed.is_code && code ? 0.7 : 0),
  };
}
