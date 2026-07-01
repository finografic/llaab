import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { LlmProvider, LlmProviderResult } from '../provider.js';
import type { LlmCompleteOptions, LlmProgress } from '../types.js';

const execFileAsync = promisify(execFile);

export interface LmStudioModelInfo {
  capabilities?: string[];
  contextLength?: number;
  created?: number;
  details?: {
    domain?: string;
    family?: string;
    format?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
  digest?: string;
  modified_at?: Date | string;
  name: string;
  owned_by?: string;
  provider: 'lmstudio';
  size?: number;
}

interface OpenAiModel {
  created?: number;
  id: string;
  object?: string;
  owned_by?: string;
}

interface OpenAiModelsResponse {
  data?: OpenAiModel[];
}

interface LmStudioCliModel {
  architecture?: string;
  format?: string;
  indexedModelIdentifier?: string;
  maxContextLength?: number;
  modelKey?: string;
  paramsString?: string;
  quantization?: {
    name?: string;
  };
  sizeBytes?: number;
  trainedForToolUse?: boolean;
  type?: string;
  vision?: boolean;
}

interface OpenAiChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    completion_tokens?: number;
    prompt_tokens?: number;
  };
}

const DEFAULT_BASE_URL = 'http://localhost:1234/v1';
const DEFAULT_CLI_PATH = `${process.env['HOME'] ?? ''}/.lmstudio/bin/lms`;
const DEFAULT_TEMPERATURE = 0.3;
const LOAD_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_COMPLETION_TIMEOUT_MS = 20 * 60 * 1000;
const DEFAULT_API_TIMEOUT_MS = 30 * 1000;
const PROGRESS_POLL_INTERVAL_MS = 2500;

const MODEL_LOAD_OVERRIDES: Record<string, { contextLength?: number; parallel?: number }> = {
  'google/gemma-4-26b-a4b-qat': {
    contextLength: 32768,
    parallel: 2,
  },
};

function getBaseUrl() {
  return (process.env['LLAAB_LMSTUDIO_BASE_URL'] ?? DEFAULT_BASE_URL).replace(/\/$/, '');
}

function getCliPath() {
  return process.env['LLAAB_LMSTUDIO_CLI_PATH'] ?? DEFAULT_CLI_PATH;
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const apiKey = process.env['LLAAB_LMSTUDIO_API_KEY'];
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  return headers;
}

function getTemperature() {
  const configured = Number(process.env['LLAAB_LMSTUDIO_TEMPERATURE']);
  return Number.isFinite(configured) ? configured : DEFAULT_TEMPERATURE;
}

function buildMessages(prompt: string, system?: string) {
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });
  return messages;
}

function getCompletionTimeoutMs() {
  const configured = Number(process.env['LLAAB_LMSTUDIO_COMPLETION_TIMEOUT_MS']);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_COMPLETION_TIMEOUT_MS;
}

async function lmStudioFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const timeoutMs = path.includes('/chat/completions') ? getCompletionTimeoutMs() : DEFAULT_API_TIMEOUT_MS;
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: getHeaders(),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      body
        ? `LM Studio request failed: ${response.status} ${body}`
        : `LM Studio request failed: ${response.status}`,
    );
  }
  return (await response.json()) as T;
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

function loadedModelMatches(model: unknown, requestedModel: string) {
  return readLoadedModelIds(model).some(
    (id) => id === requestedModel || id.endsWith(`/${requestedModel}`) || requestedModel.endsWith(`/${id}`),
  );
}

async function listLoadedModels(): Promise<unknown[]> {
  const { stdout } = await execFileAsync(getCliPath(), ['ps', '--json'], {
    maxBuffer: 1024 * 1024,
    timeout: 5000,
  });
  const parsed = JSON.parse(stdout) as unknown;
  return Array.isArray(parsed) ? parsed : [];
}

function normalizeLmStudioStatus(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('loading')) return 'loading';
  if (normalized.includes('processing')) return 'processing prompt';
  if (normalized.includes('gen')) return 'generating';
  if (normalized.includes('idle')) return 'idle';
  return normalized || undefined;
}

function parseLmStudioProgressLine(line: string, model: string): LlmProgress | undefined {
  if (!line.includes(model)) return undefined;

  const statusMatch = line.match(
    /\b(LOADING\s+\d+(?:\.\d+)?%|PROCESSING\s+PROMPT\s+\d+(?:\.\d+)?%|GEN\s+[\d,]+\s+tok|IDLE)\b/i,
  );
  if (!statusMatch) return undefined;

  const rawStatus = statusMatch[1] ?? '';
  const tokenMatch = rawStatus.match(/GEN\s+([\d,]+)\s+tok/i);
  return {
    status: normalizeLmStudioStatus(rawStatus),
    completionTokens: tokenMatch?.[1] ? Number.parseInt(tokenMatch[1].replaceAll(',', ''), 10) : undefined,
  };
}

async function pollLmStudioProgress(model: string): Promise<LlmProgress | undefined> {
  const { stdout } = await execFileAsync(getCliPath(), ['ps'], {
    maxBuffer: 1024 * 1024,
    timeout: 5000,
  });
  return stdout
    .split('\n')
    .map((line) => parseLmStudioProgressLine(line, model))
    .find((progress) => progress != null);
}

function startProgressPolling(model: string, onProgress?: LlmCompleteOptions['onProgress']) {
  if (!onProgress) return () => {};

  const reportProgress = onProgress;
  let stopped = false;
  let lastSignature = '';

  async function tick() {
    if (stopped) return;
    try {
      const progress = await pollLmStudioProgress(model);
      if (!progress) return;
      const signature = `${progress.status ?? ''}:${progress.completionTokens ?? ''}`;
      if (signature === lastSignature) return;
      lastSignature = signature;
      await reportProgress(progress);
    } catch {
      // Progress is best-effort; the completion request is the source of truth.
    }
  }

  const interval = setInterval(() => void tick(), PROGRESS_POLL_INTERVAL_MS);
  void tick();

  return () => {
    stopped = true;
    clearInterval(interval);
  };
}

async function ensureRequestedModelLoaded(model: string) {
  const loadedModels = await listLoadedModels();
  if (loadedModels.some((loadedModel) => loadedModelMatches(loadedModel, model))) return;

  if (loadedModels.length > 0) {
    await execFileAsync(getCliPath(), ['unload', '--all'], {
      maxBuffer: 1024 * 1024,
      timeout: 30000,
    });
  }

  const override = MODEL_LOAD_OVERRIDES[model];
  const loadArgs = ['load', model, '--yes'];
  if (override?.contextLength) loadArgs.push('--context-length', String(override.contextLength));
  if (override?.parallel) loadArgs.push('--parallel', String(override.parallel));

  await execFileAsync(getCliPath(), loadArgs, {
    maxBuffer: 1024 * 1024,
    timeout: LOAD_TIMEOUT_MS,
  });
}

export async function lmStudioComplete(prompt: string, opts: LlmCompleteOptions): Promise<LlmProviderResult> {
  const start = performance.now();
  await opts.onProgress?.({ status: 'loading' });
  await ensureRequestedModelLoaded(opts.model);
  await opts.onProgress?.({ status: 'processing prompt' });
  const stopProgressPolling = startProgressPolling(opts.model, opts.onProgress);
  const response = await lmStudioFetch<OpenAiChatResponse>('/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: opts.model,
      messages: buildMessages(prompt, opts.system),
      temperature: getTemperature(),
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    }),
  }).finally(stopProgressPolling);
  const text = response.choices?.[0]?.message?.content;
  if (!text) throw new Error('Unexpected response from LM Studio');
  await opts.onProgress?.({
    status: 'completed',
    completionTokens: response.usage?.completion_tokens,
  });

  return {
    text,
    durationMs: Math.round(performance.now() - start),
    providerId: 'lmstudio',
    model: opts.model,
    promptTokens: response.usage?.prompt_tokens,
    completionTokens: response.usage?.completion_tokens,
  };
}

export async function* lmStudioStream(prompt: string, opts: LlmCompleteOptions): AsyncGenerator<string> {
  yield (await lmStudioComplete(prompt, opts)).text;
}

export async function lmStudioListModels(): Promise<string[]> {
  const [response, cliDetails] = await Promise.all([
    lmStudioFetch<OpenAiModelsResponse>('/models'),
    lmStudioListCliModelDetails(),
  ]);
  return (response.data ?? [])
    .map((model) => model.id)
    .filter((id) => id && isLmStudioChatModel(id, cliDetails.get(id)));
}

function inferParameterSize(modelId: string, paramsString?: string) {
  const normalized = modelId.toLowerCase();
  if (normalized.includes('26b')) return '26B';
  if (normalized.includes('e4b')) return '7.9B';
  if (normalized.includes('e2b')) return '2B';
  return paramsString;
}

function mapCliModel(model: LmStudioCliModel): Partial<LmStudioModelInfo> {
  const capabilities = [
    model.vision ? 'vision' : undefined,
    model.trainedForToolUse ? 'tools' : undefined,
    model.architecture?.toLowerCase().includes('gemma4') ? 'reasoning' : undefined,
  ].filter((capability): capability is string => Boolean(capability));

  return {
    capabilities,
    contextLength: model.maxContextLength,
    details: {
      domain: model.type === 'llm' ? 'llm' : model.type,
      family: model.architecture,
      format: model.format === 'safetensors' ? 'mlx' : model.format,
      parameter_size: inferParameterSize(
        model.modelKey ?? model.indexedModelIdentifier ?? '',
        model.paramsString,
      ),
      quantization_level: model.quantization?.name,
    },
    size: model.sizeBytes,
  };
}

async function lmStudioListCliModelDetails(): Promise<Map<string, Partial<LmStudioModelInfo>>> {
  try {
    const { stdout } = await execFileAsync(getCliPath(), ['ls', '--json'], {
      maxBuffer: 1024 * 1024,
      timeout: 3000,
    });
    const models = JSON.parse(stdout) as LmStudioCliModel[];
    return new Map(
      models
        .filter((model) => model.modelKey || model.indexedModelIdentifier)
        .map((model) => [model.modelKey ?? model.indexedModelIdentifier ?? '', mapCliModel(model)]),
    );
  } catch {
    return new Map();
  }
}

function isLmStudioChatModel(modelId: string, details?: Partial<LmStudioModelInfo>) {
  if (details?.details?.domain === 'embedding') return false;
  return !modelId.toLowerCase().includes('embedding');
}

export async function lmStudioListModelDetails(): Promise<LmStudioModelInfo[]> {
  const [response, cliDetails] = await Promise.all([
    lmStudioFetch<OpenAiModelsResponse>('/models'),
    lmStudioListCliModelDetails(),
  ]);
  return (response.data ?? [])
    .filter((model) => isLmStudioChatModel(model.id, cliDetails.get(model.id)))
    .map((model) => {
      const enriched = cliDetails.get(model.id);

      return {
        ...enriched,
        created: model.created,
        details: {
          ...enriched?.details,
          family: enriched?.details?.family ?? model.id.split('/')[0],
        },
        modified_at: model.created ? new Date(model.created * 1000).toISOString() : undefined,
        name: model.id,
        owned_by: model.owned_by,
        provider: 'lmstudio',
      };
    });
}

export const lmStudioProvider: LlmProvider = {
  id: 'lmstudio',
  displayName: 'LM Studio',
  capabilities: ['chat', 'summarize', 'extract', 'reduce', 'structure'],
  complete: lmStudioComplete,
  stream: lmStudioStream,
  async isAvailable() {
    try {
      await lmStudioListModels();
      return true;
    } catch {
      return false;
    }
  },
};
