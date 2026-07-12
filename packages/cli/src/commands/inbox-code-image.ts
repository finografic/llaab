import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { resolveLlmRoute } from '@llaab/llm';

const execFileAsync = promisify(execFile);
const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';
const DEFAULT_LMSTUDIO_BASE_URL = 'http://localhost:1234/v1';
const DEFAULT_LMSTUDIO_CLI_PATH = `${process.env['HOME'] ?? ''}/.lmstudio/bin/lms`;
const LOAD_TIMEOUT_MS = 5 * 60 * 1000;
const VISION_MAX_TOKENS = 4096;
const LMSTUDIO_MODEL_LOAD_OVERRIDES: Record<string, { contextLength?: number; parallel?: number }> = {
  'google/gemma-4-26b-a4b-qat': {
    contextLength: 32768,
    parallel: 2,
  },
};

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
  const route = resolveLlmRoute('vision');
  const prompt = buildCodeImagePrompt(input.description);

  try {
    const text =
      route.provider === 'ollama'
        ? await extractCodeWithOllamaVision(route.model, prompt, input.imageBase64)
        : route.provider === 'lmstudio'
          ? await extractCodeWithLmStudioVision(route.model, prompt, input)
          : undefined;

    if (!text) {
      return { ok: false, error: `vision route provider is not local image-capable: ${route.provider}` };
    }

    const parsed = parseCodeImageExtraction(text);
    if (!parsed) {
      return { ok: false, error: 'vision model returned invalid code extraction JSON' };
    }

    return { ok: true, provider: route.provider, model: route.model, result: parsed };
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

async function extractCodeWithOllamaVision(
  model: string,
  prompt: string,
  imageBase64: string,
): Promise<string> {
  const baseUrl = (resolveEnvValue('OLLAMA_HOST') || DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/u, '');
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt, images: [imageBase64] }],
      stream: false,
      format: 'json',
      options: { temperature: 0, num_ctx: 16384, num_predict: VISION_MAX_TOKENS },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama vision request failed (${response.status}): ${await response.text()}`);
  }

  const body = (await response.json()) as { message?: { content?: string } };
  if (!body.message?.content) {
    throw new Error('Ollama vision response was empty');
  }

  return body.message.content;
}

async function extractCodeWithLmStudioVision(
  model: string,
  prompt: string,
  input: CodeImageExtractionInput,
): Promise<string> {
  await ensureLmStudioModelLoaded(model);

  const baseUrl = (resolveEnvValue('LLAAB_LMSTUDIO_BASE_URL') || DEFAULT_LMSTUDIO_BASE_URL).replace(
    /\/+$/u,
    '',
  );
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const apiKey = resolveEnvValue('LLAAB_LMSTUDIO_API_KEY');
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:${input.mimeType};base64,${input.imageBase64}` },
            },
          ],
        },
      ],
      temperature: 0,
      max_tokens: VISION_MAX_TOKENS,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`LM Studio vision request failed (${response.status}): ${await response.text()}`);
  }

  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = body.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('LM Studio vision response was empty');
  }

  return text;
}

async function ensureLmStudioModelLoaded(model: string): Promise<void> {
  const loadedModels = await listLoadedLmStudioModels();
  if (loadedModels.some((loadedModel) => loadedModelMatches(loadedModel, model))) return;

  if (loadedModels.length > 0) {
    await execFileAsync(getLmStudioCliPath(), ['unload', '--all'], {
      maxBuffer: 1024 * 1024,
      timeout: 30000,
    });
  }

  const override = LMSTUDIO_MODEL_LOAD_OVERRIDES[model];
  const loadArgs = ['load', model, '--yes'];
  if (override?.contextLength) loadArgs.push('--context-length', String(override.contextLength));
  if (override?.parallel) loadArgs.push('--parallel', String(override.parallel));

  await execFileAsync(getLmStudioCliPath(), loadArgs, {
    maxBuffer: 1024 * 1024,
    timeout: LOAD_TIMEOUT_MS,
  });
}

async function listLoadedLmStudioModels(): Promise<unknown[]> {
  const { stdout } = await execFileAsync(getLmStudioCliPath(), ['ps', '--json'], {
    maxBuffer: 1024 * 1024,
    timeout: 5000,
  });
  const parsed = JSON.parse(stdout) as unknown;
  return Array.isArray(parsed) ? parsed : [];
}

function loadedModelMatches(model: unknown, requestedModel: string): boolean {
  return readLoadedModelIds(model).some(
    (id) => id === requestedModel || id.endsWith(`/${requestedModel}`) || requestedModel.endsWith(`/${id}`),
  );
}

function readLoadedModelIds(model: unknown): string[] {
  if (!model || typeof model !== 'object') return [];
  const record = model as Record<string, unknown>;
  return [
    record['identifier'],
    record['modelKey'],
    record['model_key'],
    record['indexedModelIdentifier'],
    record['path'],
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);
}

function getLmStudioCliPath(): string {
  return resolveEnvValue('LLAAB_LMSTUDIO_CLI_PATH') ?? DEFAULT_LMSTUDIO_CLI_PATH;
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

function resolveEnvValue(name: string): string | undefined {
  const direct = process.env[name]?.trim();

  if (direct) {
    return direct;
  }

  for (const path of envFileCandidates()) {
    const value = readEnvFileValue(path, name);

    if (value) {
      return value;
    }
  }

  return undefined;
}

function envFileCandidates(): string[] {
  const home = process.env['HOME'];
  const llaabRepo = process.env['LLAAB_REPO_DIR'] ?? (home ? join(home, 'LLAAB') : undefined);

  return [
    join(process.cwd(), '.env'),
    ...(llaabRepo ? [join(llaabRepo, '.env')] : []),
    ...(home ? [join(home, '.hermes', '.env')] : []),
  ];
}

function readEnvFileValue(path: string, name: string): string | undefined {
  if (!existsSync(path)) {
    return undefined;
  }

  const prefix = `${name}=`;

  for (const line of readFileSync(path, 'utf-8').split(/\r?\n/u)) {
    if (!line.startsWith(prefix)) {
      continue;
    }

    return (
      line
        .slice(prefix.length)
        .trim()
        .replace(/^["']|["']$/gu, '') || undefined
    );
  }

  return undefined;
}
