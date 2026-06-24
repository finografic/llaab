import type { LlmProvider, LlmProviderResult } from '../provider.js';
import type { LlmCompleteOptions } from '../types.js';

export interface LmStudioModelInfo {
  created?: number;
  details?: {
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

interface OpenAiChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    completion_tokens?: number;
    prompt_tokens?: number;
  };
}

const DEFAULT_BASE_URL = 'http://localhost:1234/v1';

function getBaseUrl() {
  return (process.env['LLAAB_LMSTUDIO_BASE_URL'] ?? DEFAULT_BASE_URL).replace(/\/$/, '');
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const apiKey = process.env['LLAAB_LMSTUDIO_API_KEY'];
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  return headers;
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
  const response = await lmStudioFetch<OpenAiModelsResponse>('/models');
  return (response.data ?? []).map((model) => model.id).filter(Boolean);
}

export async function lmStudioListModelDetails(): Promise<LmStudioModelInfo[]> {
  const response = await lmStudioFetch<OpenAiModelsResponse>('/models');
  return (response.data ?? []).map((model) => ({
    created: model.created,
    details: {
      family: model.id.split('/')[0],
    },
    modified_at: model.created ? new Date(model.created * 1000).toISOString() : undefined,
    name: model.id,
    owned_by: model.owned_by,
    provider: 'lmstudio',
  }));
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
