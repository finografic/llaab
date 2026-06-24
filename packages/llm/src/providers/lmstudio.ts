import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { LlmProvider, LlmProviderResult } from '../provider.js';
import type { LlmCompleteOptions } from '../types.js';

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
const DEFAULT_TEMPERATURE = 0.3;

function getBaseUrl() {
  return (process.env['LLAAB_LMSTUDIO_BASE_URL'] ?? DEFAULT_BASE_URL).replace(/\/$/, '');
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

async function lmStudioFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: getHeaders(),
  });
  if (!response.ok) throw new Error(`LM Studio request failed: ${response.status}`);
  return (await response.json()) as T;
}

export async function lmStudioComplete(prompt: string, opts: LlmCompleteOptions): Promise<LlmProviderResult> {
  const start = performance.now();
  const response = await lmStudioFetch<OpenAiChatResponse>('/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: opts.model,
      messages: buildMessages(prompt, opts.system),
      temperature: getTemperature(),
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    }),
  });
  const text = response.choices?.[0]?.message?.content;
  if (!text) throw new Error('Unexpected response from LM Studio');

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
    const { stdout } = await execFileAsync('lms', ['ls', '--json'], {
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
