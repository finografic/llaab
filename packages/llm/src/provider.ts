import type { LlmCompleteOptions, LlmImageInput, LlmProviderId } from './types.js';
import type { Capability } from '@llaab/core';

export interface LlmProviderResult {
  text: string;
  durationMs: number;
  providerId: LlmProviderId;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
}

export interface LlmProvider {
  readonly id: LlmProviderResult['providerId'];
  readonly displayName: string;
  readonly capabilities: Capability[];
  complete(prompt: string, opts: LlmCompleteOptions): Promise<LlmProviderResult>;
  completeWithImage?(
    prompt: string,
    image: LlmImageInput,
    opts: LlmCompleteOptions,
  ): Promise<LlmProviderResult>;
  stream(prompt: string, opts: LlmCompleteOptions): AsyncGenerator<string>;
  isAvailable(): Promise<boolean>;
}
