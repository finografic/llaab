export {
  cloudCatalogModelToRemoteDetail,
  resolveAnthropicCatalog,
  resolveOpenCodeCatalog,
} from './cloud-model-catalog.js';
export type {
  CloudCatalogModel,
  CloudCatalogSource,
  CloudModelProvider,
  ModelAvailability,
  RemoteModelDetail,
} from './cloud-model-catalog.js';
export { findExecutorProvidersByCapability, getExecutorStatus } from './executor-router.js';
export {
  findProvidersByCapability,
  getLlmStatus,
  invalidateLlmCache,
  LlmStructuredOutputError,
  lmStudioListModelDetails,
  lmStudioListModels,
  ollamaGetModelContextLength,
  ollamaListModelDetails,
  ollamaListModels,
  openCodeListModelDetails,
  openCodeListModels,
  resolveLlmRoute,
  routeLlm,
  routeLlmObject,
  streamLlm,
  updateLlmTaskRoute,
} from './router.js';
export type {
  LlmCompleteResult,
  LlmObjectResult,
  LlmProgress,
  LlmProviderId,
  ModelTier,
  TaskType,
} from './router.js';
export type { ExecutionPlan, ExecutionResult, ExecutorProvider } from './executor-provider.js';
export type { LlmProvider, LlmProviderResult } from './provider.js';

// Legacy — kept for backward compat; prefer routeLlm
export { summarizeText } from './client.js';
