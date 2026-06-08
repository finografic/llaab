import type { LlmProvider } from './provider.js';
import type { LlmCompleteOptions, LlmCompleteResult, ModelTier, TaskType } from './types.js';
import type { Capability } from '@llaab/core';

import { cacheDelete, cacheGet, cacheSet } from './cache.js';
import { anthropicProvider } from './providers/anthropic.js';
import { ollamaListModels, ollamaProvider } from './providers/ollama.js';

// ── Tier → model name (env-configurable) ─────────────────────────────────────

const MODEL_MAP: Record<ModelTier, string> = {
  'local-small': process.env['LLAAB_LOCAL_SMALL_MODEL'] ?? 'llama3.2:3b',
  'local-mid': process.env['LLAAB_LOCAL_MID_MODEL'] ?? 'llama3:latest',
  'remote': process.env['LLAAB_REMOTE_MODEL'] ?? 'claude-sonnet-4-6',
};

// ── Task → tier ───────────────────────────────────────────────────────────────

const ROUTING: Record<TaskType, ModelTier> = {
  format: 'local-small',
  extract: 'local-mid',
  code: 'local-mid',
  reason: 'remote',
};

const PROVIDERS: Record<ModelTier, LlmProvider> = {
  'local-small': ollamaProvider,
  'local-mid': ollamaProvider,
  'remote': anthropicProvider,
};

// ── Cacheable tasks ───────────────────────────────────────────────────────────

const CACHEABLE = new Set<TaskType>(['format', 'extract']);

/**
 * Evict a cached `routeLlm` response for a cacheable task. Call this when the cached response turns
 * out to be unusable (e.g. fails downstream schema validation) — otherwise every retry replays the
 * same broken output instead of re-querying the model.
 */
export function invalidateLlmCache(task: TaskType, prompt: string, override?: string): void {
  if (!CACHEABLE.has(task)) return;
  const { model } = resolveModel(task, override);
  cacheDelete(prompt, model);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveModel(
  task: TaskType,
  override?: string,
): { model: string; tier: ModelTier; provider: LlmProvider } {
  const tier = ROUTING[task];
  return { model: override ?? MODEL_MAP[tier], tier, provider: PROVIDERS[tier] };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function resolveLlmRoute(
  task: TaskType,
  override?: string,
): { model: string; tier: ModelTier; provider: LlmProvider['id'] } {
  const { model, tier, provider } = resolveModel(task, override);
  return { model, tier, provider: provider.id };
}

export function findProvidersByCapability(capability: Capability): LlmProvider[] {
  return Object.values(PROVIDERS).filter((provider, index, providers) => {
    const firstIndex = providers.findIndex((candidate) => candidate.id === provider.id);
    return firstIndex === index && provider.capabilities.includes(capability);
  });
}

export async function routeLlm(
  task: TaskType,
  prompt: string,
  opts?: { model?: string; system?: string; maxTokens?: number },
): Promise<LlmCompleteResult> {
  const { model, provider } = resolveModel(task, opts?.model);
  const completeOpts: LlmCompleteOptions = { model, system: opts?.system, maxTokens: opts?.maxTokens };

  if (CACHEABLE.has(task)) {
    const hit = cacheGet(prompt, model);
    if (hit) return { text: hit, model, cached: true, provider: provider.id, durationMs: 0 };
  }

  const result = await provider.complete(prompt, completeOpts);

  if (CACHEABLE.has(task)) cacheSet(prompt, model, result.text);

  return {
    text: result.text,
    model: result.model,
    cached: false,
    provider: result.providerId,
    durationMs: result.durationMs,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
  };
}

export async function* streamLlm(
  task: TaskType,
  prompt: string,
  opts?: { model?: string; system?: string; maxTokens?: number },
): AsyncGenerator<string> {
  const { model, provider } = resolveModel(task, opts?.model);
  const completeOpts: LlmCompleteOptions = { model, system: opts?.system, maxTokens: opts?.maxTokens };

  yield* provider.stream(prompt, completeOpts);
}

export async function getLlmStatus(): Promise<{
  availableProviders: Array<LlmProvider['id']>;
  capabilities: Array<{
    available: boolean;
    capabilities: Capability[];
    displayName: string;
    provider: LlmProvider['id'];
  }>;
  modelMap: Record<ModelTier, string>;
  routing: Record<TaskType, { tier: ModelTier; model: string; provider: LlmProvider['id'] }>;
}> {
  const uniqueProviders = [
    ...new Map(Object.values(PROVIDERS).map((provider) => [provider.id, provider])).values(),
  ];
  const availableProviders = (
    await Promise.all(
      uniqueProviders.map(async (provider) => ({
        id: provider.id,
        available: await provider.isAvailable(),
      })),
    )
  )
    .filter((provider) => provider.available)
    .map((provider) => provider.id);

  return {
    availableProviders,
    capabilities: await Promise.all(
      uniqueProviders.map(async (provider) => ({
        available: availableProviders.includes(provider.id),
        capabilities: provider.capabilities,
        displayName: provider.displayName,
        provider: provider.id,
      })),
    ),
    modelMap: { ...MODEL_MAP },
    routing: Object.fromEntries(
      Object.entries(ROUTING).map(([task, tier]) => [
        task,
        { tier, model: MODEL_MAP[tier], provider: PROVIDERS[tier].id },
      ]),
    ) as Record<TaskType, { tier: ModelTier; model: string; provider: LlmProvider['id'] }>,
  };
}

export { ollamaListModels };
export type { LlmCompleteResult, ModelTier, TaskType };
