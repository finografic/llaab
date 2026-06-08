export { findExecutorProvidersByCapability, getExecutorStatus } from './executor-router.js';
export {
  findProvidersByCapability,
  getLlmStatus,
  invalidateLlmCache,
  ollamaListModels,
  resolveLlmRoute,
  routeLlm,
  streamLlm,
} from './router.js';
export type { LlmCompleteResult, ModelTier, TaskType } from './router.js';
export type { ExecutionPlan, ExecutionResult, ExecutorProvider } from './executor-provider.js';
export type { LlmProvider, LlmProviderResult } from './provider.js';

// Legacy — kept for backward compat; prefer routeLlm
export { summarizeText } from './client.js';
export type { LlmProviderId } from './client.js';
