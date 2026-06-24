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
export type LlmProviderId = 'ollama' | 'anthropic' | 'lmstudio';

export interface LlmCompleteOptions {
  model: string;
  system?: string;
  maxTokens?: number;
  bypassCache?: boolean;
  onProgress?: (progress: LlmProgress) => void | Promise<void>;
}

export interface LlmProgress {
  status?: string;
  completionTokens?: number;
}

export interface LlmCompleteResult {
  text: string;
  model: string;
  cached: boolean;
  provider: LlmProviderId;
  durationMs: number;
  promptTokens?: number;
  completionTokens?: number;
}
