import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { LlmProvider } from './provider.js';
import type { LlmCompleteOptions, LlmCompleteResult, LlmProviderId, ModelTier, TaskType } from './types.js';
import type { Capability } from '@llaab/core';

import { cacheDelete, cacheGet, cacheSet } from './cache.js';
import { anthropicProvider } from './providers/anthropic.js';
import { lmStudioListModelDetails, lmStudioListModels, lmStudioProvider } from './providers/lmstudio.js';
import {
  ollamaGetModelContextLength,
  ollamaListModelDetails,
  ollamaListModels,
  ollamaProvider,
} from './providers/ollama.js';

// ── Tier → model name (env-configurable) ─────────────────────────────────────

const MODEL_MAP: Record<ModelTier, string> = {
  'local-small': process.env['LLAAB_LOCAL_SMALL_MODEL'] ?? 'llama3.2:3b',
  'local-mid': process.env['LLAAB_LOCAL_MID_MODEL'] ?? 'llama3:latest',
  'local-strong': process.env['LLAAB_LOCAL_STRONG_MODEL'] ?? 'gpt-oss:20b',
  'remote': process.env['LLAAB_REMOTE_MODEL'] ?? 'claude-sonnet-4-6',
};

// ── Task routing ──────────────────────────────────────────────────────────────

interface TaskRoute {
  tier: ModelTier;
  model: string;
  provider: LlmProviderId;
}

const DEFAULT_ROUTING: Record<TaskType, TaskRoute> = {
  'route': { tier: 'local-mid', model: MODEL_MAP['local-mid'], provider: 'ollama' },
  'format': { tier: 'local-small', model: MODEL_MAP['local-small'], provider: 'ollama' },
  'extract': { tier: 'local-mid', model: MODEL_MAP['local-mid'], provider: 'ollama' },
  'consolidate': { tier: 'local-strong', model: MODEL_MAP['local-strong'], provider: 'ollama' },
  'code': { tier: 'local-strong', model: MODEL_MAP['local-strong'], provider: 'ollama' },
  'reason': { tier: 'local-strong', model: MODEL_MAP['local-strong'], provider: 'ollama' },
  'reason-plus': { tier: 'remote', model: MODEL_MAP['remote'], provider: 'anthropic' },
  'vision': { tier: 'local-mid', model: MODEL_MAP['local-mid'], provider: 'ollama' },
  'speech': { tier: 'local-mid', model: MODEL_MAP['local-mid'], provider: 'ollama' },
};

const PROVIDERS_BY_ID: Record<LlmProviderId, LlmProvider> = {
  ollama: ollamaProvider,
  anthropic: anthropicProvider,
  lmstudio: lmStudioProvider,
};

const UNIQUE_PROVIDERS = [ollamaProvider, anthropicProvider, lmStudioProvider];

const ROUTING_CONFIG_PATH = resolve(process.cwd(), 'configs/llm-routing.json');

interface RoutingConfigFile {
  tasks?: Partial<Record<TaskType, Partial<TaskRoute>>>;
}

// ── Cacheable tasks ───────────────────────────────────────────────────────────

const CACHEABLE = new Set<TaskType>(['route', 'format', 'extract']);

/**
 * Evict a cached `routeLlm` response for a cacheable task. Call this when the cached response turns
 * out to be unusable (e.g. fails downstream schema validation) — otherwise every retry replays the
 * same broken output instead of re-querying the model.
 */
export function invalidateLlmCache(task: TaskType, prompt: string, override?: string): void {
  if (!CACHEABLE.has(task)) return;
  const { model, provider } = resolveModel(task, override);
  cacheDelete(prompt, `${provider.id}:${model}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveModel(
  task: TaskType,
  override?: string,
): { model: string; tier: ModelTier; provider: LlmProvider } {
  const route = getRouting()[task];
  return {
    model: override ?? route.model,
    tier: route.tier,
    provider: override ? PROVIDERS_BY_ID[route.provider] : PROVIDERS_BY_ID[route.provider],
  };
}

function readRoutingConfig(): RoutingConfigFile {
  if (!existsSync(ROUTING_CONFIG_PATH)) return {};

  try {
    return JSON.parse(readFileSync(ROUTING_CONFIG_PATH, 'utf8')) as RoutingConfigFile;
  } catch {
    return {};
  }
}

function writeRoutingConfig(config: RoutingConfigFile): void {
  mkdirSync(dirname(ROUTING_CONFIG_PATH), { recursive: true });
  writeFileSync(ROUTING_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
}

function isTaskType(value: string): value is TaskType {
  return value in DEFAULT_ROUTING;
}

function isModelTier(value: string): value is ModelTier {
  return value in MODEL_MAP;
}

function isProviderId(value: string): value is LlmProviderId {
  return value in PROVIDERS_BY_ID;
}

function getRouting(): Record<TaskType, TaskRoute> {
  const config = readRoutingConfig();
  const routing = { ...DEFAULT_ROUTING };

  for (const [task, override] of Object.entries(config.tasks ?? {})) {
    if (!isTaskType(task)) continue;

    const base = routing[task];
    const tier = override.tier && isModelTier(override.tier) ? override.tier : base.tier;
    const provider = override.provider && isProviderId(override.provider) ? override.provider : base.provider;

    routing[task] = {
      tier,
      provider,
      model: override.model ?? base.model,
    };
  }

  return routing;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function resolveLlmRoute(
  task: TaskType,
  override?: string,
): { model: string; tier: ModelTier; provider: LlmProviderId } {
  const { model, tier, provider } = resolveModel(task, override);
  return { model, tier, provider: provider.id as LlmProviderId };
}

export function findProvidersByCapability(capability: Capability): LlmProvider[] {
  return UNIQUE_PROVIDERS.filter((provider) => provider.capabilities.includes(capability));
}

export async function routeLlm(
  task: TaskType,
  prompt: string,
  opts?: { model?: string; system?: string; maxTokens?: number; bypassCache?: boolean },
): Promise<LlmCompleteResult> {
  const { model, provider } = resolveModel(task, opts?.model);
  const completeOpts: LlmCompleteOptions = {
    model,
    system: opts?.system,
    maxTokens: opts?.maxTokens,
    bypassCache: opts?.bypassCache,
  };

  if (CACHEABLE.has(task) && !completeOpts.bypassCache) {
    const hit = cacheGet(prompt, `${provider.id}:${model}`);
    if (hit) return { text: hit, model, cached: true, provider: provider.id, durationMs: 0 };
  }

  const result = await provider.complete(prompt, completeOpts);

  if (CACHEABLE.has(task)) cacheSet(prompt, `${provider.id}:${model}`, result.text);

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
  routing: Record<TaskType, { tier: ModelTier; model: string; provider: LlmProviderId }>;
}> {
  const availableProviders = (
    await Promise.all(
      UNIQUE_PROVIDERS.map(async (provider) => ({
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
      UNIQUE_PROVIDERS.map(async (provider) => ({
        available: availableProviders.includes(provider.id),
        capabilities: provider.capabilities,
        displayName: provider.displayName,
        provider: provider.id,
      })),
    ),
    modelMap: { ...MODEL_MAP },
    routing: getRouting(),
  };
}

export function updateLlmTaskRoute(task: TaskType, route: Partial<TaskRoute>): Record<TaskType, TaskRoute> {
  const current = readRoutingConfig();
  const existingTaskRoutes = current.tasks ?? {};
  const currentRoute = getRouting()[task];
  const nextRoute: TaskRoute = {
    tier: route.tier ?? currentRoute.tier,
    provider: route.provider ?? currentRoute.provider,
    model: route.model ?? currentRoute.model,
  };

  writeRoutingConfig({
    ...current,
    tasks: {
      ...existingTaskRoutes,
      [task]: nextRoute,
    },
  });

  return getRouting();
}

export {
  lmStudioListModelDetails,
  lmStudioListModels,
  ollamaGetModelContextLength,
  ollamaListModelDetails,
  ollamaListModels,
};
export type { LlmCompleteResult, LlmProviderId, ModelTier, TaskType };
