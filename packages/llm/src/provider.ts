import type { LlmCompleteOptions } from './types.js';

export interface LlmProviderResult {
  text: string;
  durationMs: number;
  providerId: 'ollama' | 'anthropic';
  model: string;
  promptTokens?: number;
  completionTokens?: number;
}

export interface LlmProvider {
  readonly id: LlmProviderResult['providerId'];
  readonly displayName: string;
  complete(prompt: string, opts: LlmCompleteOptions): Promise<LlmProviderResult>;
  stream(prompt: string, opts: LlmCompleteOptions): AsyncGenerator<string>;
  isAvailable(): Promise<boolean>;
}
