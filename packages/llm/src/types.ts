export type TaskType =
  | 'route'
  | 'format'
  | 'extract'
  | 'consolidate'
  | 'code'
  | 'reason'
  | 'reason-plus'
  | 'vision'
  | 'speech';
export type ModelTier = 'local-small' | 'local-mid' | 'local-strong' | 'remote';
export type LlmProviderId = 'ollama' | 'anthropic';

export interface LlmCompleteOptions {
  model: string;
  system?: string;
  maxTokens?: number;
  bypassCache?: boolean;
}

export interface LlmCompleteResult {
  text: string;
  model: string;
  cached: boolean;
  provider: 'ollama' | 'anthropic';
  durationMs: number;
  promptTokens?: number;
  completionTokens?: number;
}
