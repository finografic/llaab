export { findExecutorProvidersByCapability, getExecutorStatus } from './executor-router.js';
export {
  findProvidersByCapability,
  getLlmStatus,
  invalidateLlmCache,
  lmStudioListModelDetails,
  lmStudioListModels,
  ollamaGetModelContextLength,
  ollamaListModelDetails,
  ollamaListModels,
  resolveLlmRoute,
  routeLlm,
  streamLlm,
  updateLlmTaskRoute,
} from './router.js';
export type { LlmCompleteResult, LlmProgress, LlmProviderId, ModelTier, TaskType } from './router.js';
export type { ExecutionPlan, ExecutionResult, ExecutorProvider } from './executor-provider.js';
export type { LlmProvider, LlmProviderResult } from './provider.js';

// Legacy — kept for backward compat; prefer routeLlm
export { summarizeText } from './client.js';
