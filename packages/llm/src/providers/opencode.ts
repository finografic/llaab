import type { LlmProvider, LlmProviderResult } from '../provider.js';
import type { LlmCompleteOptions } from '../types.js';

import { openCodeGetConfiguredModelNames } from './opencode-catalog.js';

interface OpenAiChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    completion_tokens?: number;
    prompt_tokens?: number;
  };
}

export interface OpenCodeModelInfo {
  created?: number;
  name: string;
  owned_by?: string;
  provider: 'opencode';
}

const DEFAULT_BASE_URL = 'https://opencode.ai/zen/go/v1';
const DEFAULT_TEMPERATURE = 0.3;

function getBaseUrl() {
  return (process.env['OPENCODE_BASE_URL'] ?? DEFAULT_BASE_URL).replace(/\/$/, '');
}

function getApiKey() {
  return process.env['OPENCODE_API_KEY'];
}

function getTemperature() {
  const configured = Number(process.env['OPENCODE_TEMPERATURE']);
  return Number.isFinite(configured) ? configured : DEFAULT_TEMPERATURE;
}

function buildMessages(prompt: string, system?: string) {
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });
  return messages;
}

function getHeaders(): Record<string, string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('OPENCODE_API_KEY is not configured');

  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

async function openCodeFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: getHeaders(),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      body
        ? `OpenCode request failed: ${response.status} ${body}`
        : `OpenCode request failed: ${response.status}`,
    );
  }

  return (await response.json()) as T;
}

export async function openCodeComplete(prompt: string, opts: LlmCompleteOptions): Promise<LlmProviderResult> {
  const start = performance.now();
  await opts.onProgress?.({ status: 'processing prompt' });

  const response = await openCodeFetch<OpenAiChatResponse>('/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: opts.model,
      messages: buildMessages(prompt, opts.system),
      temperature: getTemperature(),
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    }),
  });

  const text = response.choices?.[0]?.message?.content;
  if (!text) throw new Error('Unexpected response from OpenCode');

  await opts.onProgress?.({
    status: 'completed',
    completionTokens: response.usage?.completion_tokens,
  });

  return {
    text,
    durationMs: Math.round(performance.now() - start),
    providerId: 'opencode',
    model: opts.model,
    promptTokens: response.usage?.prompt_tokens,
    completionTokens: response.usage?.completion_tokens,
  };
}

export async function* openCodeStream(prompt: string, opts: LlmCompleteOptions): AsyncGenerator<string> {
  yield (await openCodeComplete(prompt, opts)).text;
}

export function openCodeListModels(): Promise<string[]> {
  return Promise.resolve(openCodeGetConfiguredModelNames());
}

export async function openCodeListModelDetails(): Promise<OpenCodeModelInfo[]> {
  const { resolveOpenCodeCatalog } = await import('../cloud-model-catalog.js');
  const catalog = await resolveOpenCodeCatalog();
  return catalog.models.map((model) => ({
    name: model.name,
    provider: 'opencode' as const,
    owned_by: model.owned_by,
    created: model.created,
  }));
}

export const openCodeProvider: LlmProvider = {
  id: 'opencode',
  displayName: 'OpenCode',
  capabilities: ['chat', 'reason', 'summarize', 'extract', 'structure', 'plan', 'code_edit'],
  complete: openCodeComplete,
  stream: openCodeStream,
  async isAvailable() {
    return Boolean(getApiKey());
  },
};
