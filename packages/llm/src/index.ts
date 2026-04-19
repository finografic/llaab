export { getLlmStatus, ollamaListModels, routeLlm, streamLlm } from './router.js';
export type { LlmCompleteResult, ModelTier, TaskType } from './router.js';

// Legacy — kept for backward compat; prefer routeLlm
export { summarizeText } from './client.js';
export type { LlmProvider } from './client.js';
