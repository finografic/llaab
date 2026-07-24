import { APICallError, generateText } from 'ai';
import type { LlmProvider, LlmProviderResult } from '../provider.js';
import type { LlmCompleteOptions } from '../types.js';

import { AI_SDK_MAX_RETRIES, resolveAiSdkModel, toProviderResult } from '../ai-sdk-model-registry.js';
import { openCodeGetConfiguredModelNames } from './opencode-catalog.js';

export interface OpenCodeModelInfo {
  created?: number;
  name: string;
  owned_by?: string;
  provider: 'opencode';
}

const DEFAULT_TEMPERATURE = 0.3;

function getApiKey() {
  return process.env['OPENCODE_API_KEY'];
}

function getTemperature() {
  const configured = Number(process.env['OPENCODE_TEMPERATURE']);
  return Number.isFinite(configured) ? configured : DEFAULT_TEMPERATURE;
}

function requireApiKey(): void {
  if (!getApiKey()) throw new Error('OPENCODE_API_KEY is not configured');
}

/**
 * Re-maps AI SDK transport errors onto the provider's existing error contract:
 * HTTP failures become `OpenCode request failed: <status> <body>`, and malformed success
 * responses (e.g. empty `choices`) become `Unexpected response from OpenCode`. Errors without
 * an HTTP status (network-level failures) propagate unchanged.
 */
function mapOpenCodeError(error: unknown): Error {
  if (APICallError.isInstance(error) && error.statusCode != null) {
    const body = error.responseBody ?? '';
    return new Error(
      body
        ? `OpenCode request failed: ${error.statusCode} ${body}`
        : `OpenCode request failed: ${error.statusCode}`,
    );
  }
  if (error instanceof TypeError) {
    return new Error('Unexpected response from OpenCode');
  }
  return error instanceof Error ? error : new Error(String(error));
}

export async function openCodeComplete(prompt: string, opts: LlmCompleteOptions): Promise<LlmProviderResult> {
  const start = performance.now();
  await opts.onProgress?.({ status: 'processing prompt' });
  requireApiKey();

  let result;
  try {
    result = await generateText({
      model: resolveAiSdkModel('opencode', opts.model),
      ...(opts.system && { system: opts.system }),
      prompt,
      temperature: getTemperature(),
      ...(opts.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
      maxRetries: AI_SDK_MAX_RETRIES,
    });
  } catch (error) {
    throw mapOpenCodeError(error);
  }

  if (!result.text) throw new Error('Unexpected response from OpenCode');

  await opts.onProgress?.({
    status: 'completed',
    completionTokens: result.usage.outputTokens,
  });

  return toProviderResult({
    text: result.text,
    usage: result.usage,
    providerId: 'opencode',
    model: opts.model,
    startedAt: start,
  });
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
