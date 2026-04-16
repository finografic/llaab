export type TaskType = 'format' | 'extract' | 'code' | 'reason';
export type ModelTier = 'local-small' | 'local-mid' | 'remote';

export interface LlmCompleteOptions {
  model: string;
  system?: string;
  maxTokens?: number;
}

export interface LlmCompleteResult {
  text: string;
  model: string;
  cached: boolean;
}
