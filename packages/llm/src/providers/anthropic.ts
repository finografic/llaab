import { generateText, streamText } from 'ai';
import type { LlmProvider, LlmProviderResult } from '../provider.js';
import type { LlmCompleteOptions } from '../types.js';

import { AI_SDK_MAX_RETRIES, resolveAiSdkModel, toProviderResult } from '../ai-sdk-model-registry.js';

const DEFAULT_MAX_TOKENS = 1024;

export async function anthropicComplete(
  prompt: string,
  opts: LlmCompleteOptions,
): Promise<LlmProviderResult> {
  const start = performance.now();
  const result = await generateText({
    model: resolveAiSdkModel('anthropic', opts.model),
    maxOutputTokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    ...(opts.system && { system: opts.system }),
    prompt,
    maxRetries: AI_SDK_MAX_RETRIES,
  });

  const block = result.content[0];
  if (block?.type !== 'text') throw new Error('Unexpected response type from Anthropic');
  return toProviderResult({
    text: block.text,
    usage: result.usage,
    providerId: 'anthropic',
    model: opts.model,
    startedAt: start,
  });
}

export async function* anthropicStream(prompt: string, opts: LlmCompleteOptions): AsyncGenerator<string> {
  const result = streamText({
    model: resolveAiSdkModel('anthropic', opts.model),
    maxOutputTokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    ...(opts.system && { system: opts.system }),
    prompt,
    maxRetries: AI_SDK_MAX_RETRIES,
  });

  for await (const chunk of result.textStream) {
    if (chunk) yield chunk;
  }
}

export const anthropicProvider: LlmProvider = {
  id: 'anthropic',
  displayName: 'Anthropic',
  capabilities: ['chat', 'reason', 'summarize', 'extract', 'structure', 'plan'],
  complete: anthropicComplete,
  stream: anthropicStream,
  async isAvailable() {
    return Boolean(process.env['ANTHROPIC_API_KEY']);
  },
};
