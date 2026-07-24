import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText, NoObjectGeneratedError, Output } from 'ai';
import type { LlmProviderResult } from './provider.js';
import type { LlmProviderId } from './types.js';
import type { LanguageModel, LanguageModelUsage } from 'ai';
import type { z } from 'zod';

import { LlmStructuredOutputError } from './structured-output.js';

/**
 * Internal AI SDK boundary for @llaab/llm (Fable migration A1). Maps LLAAB provider ids to
 * AI SDK LanguageModel instances and centralises conversion back to LLAAB-owned result types.
 * Nothing in this module may leak into the package's public exports — consumers depend on
 * LLAAB types only.
 */

/**
 * Transport-level retries are disabled. LLAAB workflows already own retry policy at the
 * semantic layer (@llaab/control, extraction/consolidation auto-retry); the AI SDK default of
 * 2 transport retries would multiply them. Every generateText/streamText call through this
 * boundary must pass this value.
 */
export const AI_SDK_MAX_RETRIES = 0;

/**
 * Providers served by the AI SDK transport. Ollama intentionally stays on the native `ollama`
 * client until the migration's Phase 6 parity decision.
 */
export type AiSdkProviderId = Exclude<LlmProviderId, 'ollama'>;

const ANTHROPIC_ENV_KEY = 'ANTHROPIC_API_KEY';
const LMSTUDIO_DEFAULT_BASE_URL = 'http://localhost:1234/v1';
const OPENCODE_DEFAULT_BASE_URL = 'https://opencode.ai/zen/go/v1';

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

/**
 * Env is read per call, matching the current providers' call-time configuration semantics —
 * tests and the /llm settings surface rely on env changes taking effect without a restart.
 */
export function resolveAiSdkModel(providerId: AiSdkProviderId, modelId: string): LanguageModel {
  switch (providerId) {
    case 'anthropic': {
      const provider = createAnthropic({ apiKey: process.env[ANTHROPIC_ENV_KEY] });
      return provider(modelId);
    }
    case 'lmstudio': {
      const provider = createOpenAICompatible({
        name: 'lmstudio',
        baseURL: stripTrailingSlash(process.env['LLAAB_LMSTUDIO_BASE_URL'] ?? LMSTUDIO_DEFAULT_BASE_URL),
        apiKey: process.env['LLAAB_LMSTUDIO_API_KEY'],
        includeUsage: true,
      });
      return provider(modelId);
    }
    case 'opencode': {
      const provider = createOpenAICompatible({
        name: 'opencode',
        baseURL: stripTrailingSlash(process.env['OPENCODE_BASE_URL'] ?? OPENCODE_DEFAULT_BASE_URL),
        apiKey: process.env['OPENCODE_API_KEY'],
        includeUsage: true,
      });
      return provider(modelId);
    }
  }
}

/**
 * Typed object generation through the AI SDK (`generateText` + `Output.object`). Schema-invalid
 * or non-JSON model output surfaces as `LlmStructuredOutputError` with the raw model text
 * preserved; transport errors propagate for the caller to map per provider.
 */
export async function generateAiSdkObject<OBJECT>(args: {
  providerId: AiSdkProviderId;
  model: string;
  prompt: string;
  schema: z.ZodType<OBJECT>;
  system?: string;
  maxTokens?: number;
}): Promise<{ object: OBJECT; text: string; usage: LanguageModelUsage | undefined }> {
  try {
    const result = await generateText({
      model: resolveAiSdkModel(args.providerId, args.model),
      ...(args.system && { system: args.system }),
      prompt: args.prompt,
      ...(args.maxTokens ? { maxOutputTokens: args.maxTokens } : {}),
      output: Output.object({ schema: args.schema }),
      maxRetries: AI_SDK_MAX_RETRIES,
    });
    return { object: result.output, text: result.text, usage: result.usage };
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      throw new LlmStructuredOutputError('Model output failed structured-output validation', {
        provider: args.providerId,
        model: args.model,
        rawText: error.text,
        cause: error,
      });
    }
    throw error;
  }
}

/**
 * Converts an AI SDK generation outcome into the LLAAB provider result shape. `startedAt` is a
 * `performance.now()` timestamp captured by the caller before any preflight work, preserving
 * each provider's existing durationMs semantics (e.g. LM Studio includes model-load time).
 */
export function toProviderResult(args: {
  text: string;
  usage: LanguageModelUsage | undefined;
  providerId: LlmProviderId;
  model: string;
  startedAt: number;
}): LlmProviderResult {
  return {
    text: args.text,
    durationMs: Math.round(performance.now() - args.startedAt),
    providerId: args.providerId,
    model: args.model,
    promptTokens: args.usage?.inputTokens,
    completionTokens: args.usage?.outputTokens,
  };
}
