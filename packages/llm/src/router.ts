import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { LlmProvider } from './provider.js';
import type { LlmObjectResult } from './structured-output.js';
import type {
  LlmCompleteOptions,
  LlmCompleteResult,
  LlmImageInput,
  LlmProgress,
  LlmProviderId,
  ModelTier,
  TaskType,
} from './types.js';
import type { Capability } from '@llaab/core';
import type { z } from 'zod';

import { generateAiSdkObject } from './ai-sdk-model-registry.js';
import { cacheDelete, cacheGet, cacheSet } from './cache.js';
import { anthropicProvider } from './providers/anthropic.js';
import { lmStudioListModelDetails, lmStudioListModels, lmStudioProvider } from './providers/lmstudio.js';
import {
  ollamaGetModelContextLength,
  ollamaListModelDetails,
  ollamaListModels,
  ollamaProvider,
} from './providers/ollama.js';
import {
  mapOpenCodeError,
  openCodeListModelDetails,
  openCodeListModels,
  openCodeProvider,
} from './providers/opencode.js';
import { extractJsonObjectPayload, LlmStructuredOutputError } from './structured-output.js';

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
  'wiki-compile': { tier: 'local-strong', model: MODEL_MAP['local-strong'], provider: 'ollama' },
  'wiki-discover': { tier: 'local-strong', model: MODEL_MAP['local-strong'], provider: 'ollama' },
  'wiki-link': { tier: 'local-strong', model: MODEL_MAP['local-strong'], provider: 'ollama' },
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
  opencode: openCodeProvider,
};

const UNIQUE_PROVIDERS = [ollamaProvider, anthropicProvider, lmStudioProvider, openCodeProvider];

const ROUTING_CONFIG_PATH = resolve(process.cwd(), 'configs/llm-routing.json');

interface RoutingConfigFile {
  tasks?: Partial<Record<TaskType, Partial<TaskRoute>>>;
}

// ── Cacheable tasks ───────────────────────────────────────────────────────────

const CACHEABLE = new Set<TaskType>(['route', 'format', 'extract']);

/**
 * Builds the cache key's provider/model/call-shape component. `system` and `maxTokens` are part
 * of the key because they change what the model actually produces — two calls with the same
 * prompt but a different system instruction (or token cap) must not collide in the cache.
 */
function buildCacheKeyContext(
  providerId: LlmProviderId,
  model: string,
  system?: string,
  maxTokens?: number,
): string {
  return `${providerId}:${model}:${system ?? ''}:${maxTokens ?? ''}`;
}

/**
 * Evict a cached `routeLlm` response for a cacheable task. Call this when the cached response turns
 * out to be unusable (e.g. fails downstream schema validation) — otherwise every retry replays the
 * same broken output instead of re-querying the model.
 *
 * Only evicts the entry cached for a call made without `system`/`maxTokens` — this function has
 * no way to know what a caller passed for those on the call it wants to invalidate. Its one
 * current caller (`@llaab/ingestion` extraction) always sets `bypassCache: true`, which since the
 * cache-key fix never writes an entry to evict in the first place, so this is a no-op there.
 */
export function invalidateLlmCache(task: TaskType, prompt: string, override?: string): void {
  if (!CACHEABLE.has(task)) return;
  const { model, provider } = resolveModel(task, override);
  cacheDelete(prompt, buildCacheKeyContext(provider.id, model));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Splits a `provider:model` override into its parts — the same encoding
 * `LlmRoutingEditor` uses for persisted routing selections. The prefix must be a recognized
 * `LlmProviderId`; otherwise the whole string is treated as a bare model name so overrides like
 * `llama3.2:3b` or `gemma4:e4b-it-qat` (real Ollama tags, not provider prefixes) are unaffected.
 */
function parseModelOverride(override: string): { provider: LlmProviderId; model: string } | undefined {
  const separatorIndex = override.indexOf(':');
  if (separatorIndex === -1) return undefined;
  const prefix = override.slice(0, separatorIndex);
  if (!isProviderId(prefix)) return undefined;
  return { provider: prefix, model: override.slice(separatorIndex + 1) };
}

function resolveModel(
  task: TaskType,
  override?: string,
): { model: string; tier: ModelTier; provider: LlmProvider } {
  const route = getRouting()[task];
  const parsedOverride = override ? parseModelOverride(override) : undefined;
  return {
    model: parsedOverride?.model ?? override ?? route.model,
    tier: route.tier,
    provider: PROVIDERS_BY_ID[parsedOverride?.provider ?? route.provider],
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
  opts?: {
    model?: string;
    system?: string;
    maxTokens?: number;
    bypassCache?: boolean;
    onProgress?: LlmCompleteOptions['onProgress'];
  },
): Promise<LlmCompleteResult> {
  const { model, provider } = resolveModel(task, opts?.model);
  const completeOpts: LlmCompleteOptions = {
    model,
    system: opts?.system,
    maxTokens: opts?.maxTokens,
    bypassCache: opts?.bypassCache,
    onProgress: opts?.onProgress,
  };

  const cacheable = CACHEABLE.has(task) && !completeOpts.bypassCache;
  const cacheKeyContext = buildCacheKeyContext(provider.id, model, opts?.system, opts?.maxTokens);

  if (cacheable) {
    const hit = cacheGet(prompt, cacheKeyContext);
    if (hit) return { text: hit, model, cached: true, provider: provider.id, durationMs: 0 };
  }

  const result = await provider.complete(prompt, completeOpts);

  // bypassCache means "don't touch the cache at all" — a bypassed call must never write a
  // response a later non-bypassed call could inherit.
  if (cacheable) cacheSet(prompt, cacheKeyContext, result.text);

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

export async function routeLlmVision(
  prompt: string,
  image: LlmImageInput,
  opts?: {
    model?: string;
    system?: string;
    maxTokens?: number;
    onProgress?: LlmCompleteOptions['onProgress'];
  },
): Promise<LlmCompleteResult> {
  const { model, provider } = resolveModel('vision', opts?.model);
  if (!provider.completeWithImage) {
    throw new Error(`vision route provider is not image-capable: ${provider.id}`);
  }
  const result = await provider.completeWithImage(prompt, image, {
    model,
    system: opts?.system,
    maxTokens: opts?.maxTokens,
    onProgress: opts?.onProgress,
  });

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

export async function routeLlmVisionObject<OBJECT>(
  prompt: string,
  image: LlmImageInput,
  schema: z.ZodType<OBJECT>,
  opts?: { model?: string; system?: string; maxTokens?: number },
): Promise<LlmObjectResult<OBJECT>> {
  const completion = await routeLlmVision(prompt, image, opts);
  return parseStructuredCompletion(completion, schema);
}

/**
 * Providers whose structured output runs through the AI SDK `Output.object` path. Local
 * providers (ollama, lmstudio) use text generation plus deterministic JSON extraction instead —
 * local models routinely fence JSON, and LM Studio's model-load lifecycle lives in `complete()`.
 */
const AI_SDK_OBJECT_PROVIDERS = new Set<LlmProviderId>(['anthropic', 'opencode']);

function parseStructuredCompletion<OBJECT>(
  completion: Omit<LlmCompleteResult, 'cached'>,
  schema: z.ZodType<OBJECT>,
): LlmObjectResult<OBJECT> {
  const errorContext = { provider: completion.provider, model: completion.model, rawText: completion.text };
  const payload = extractJsonObjectPayload(completion.text);
  if (!payload) throw new LlmStructuredOutputError('No JSON object found in model output', errorContext);

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch (cause) {
    throw new LlmStructuredOutputError('Model output is not valid JSON', { ...errorContext, cause });
  }

  const validated = schema.safeParse(parsed);
  if (!validated.success) {
    throw new LlmStructuredOutputError('Model output failed schema validation', {
      ...errorContext,
      cause: validated.error,
    });
  }

  return {
    object: validated.data,
    rawText: completion.text,
    model: completion.model,
    provider: completion.provider,
    durationMs: completion.durationMs,
    promptTokens: completion.promptTokens,
    completionTokens: completion.completionTokens,
  };
}

/**
 * Typed structured-output routing (Fable migration A4): resolves the task route like
 * `routeLlm`, generates an object matching `schema`, and returns it with the same
 * provider/model/usage metadata. Responses are never cached. Schema-invalid output throws
 * `LlmStructuredOutputError` with the raw model text preserved.
 */
export async function routeLlmObject<OBJECT>(
  task: TaskType,
  prompt: string,
  schema: z.ZodType<OBJECT>,
  opts?: { model?: string; system?: string; maxTokens?: number },
): Promise<LlmObjectResult<OBJECT>> {
  const { model, provider } = resolveModel(task, opts?.model);
  const start = performance.now();

  if (AI_SDK_OBJECT_PROVIDERS.has(provider.id)) {
    if (provider.id === 'opencode' && !process.env['OPENCODE_API_KEY']) {
      throw new Error('OPENCODE_API_KEY is not configured');
    }
    try {
      const generated = await generateAiSdkObject({
        providerId: provider.id as 'anthropic' | 'opencode',
        model,
        prompt,
        schema,
        system: opts?.system,
        maxTokens: opts?.maxTokens,
      });
      return {
        object: generated.object,
        rawText: generated.text,
        model,
        provider: provider.id,
        durationMs: Math.round(performance.now() - start),
        promptTokens: generated.usage?.inputTokens,
        completionTokens: generated.usage?.outputTokens,
      };
    } catch (error) {
      if (error instanceof LlmStructuredOutputError) throw error;
      throw provider.id === 'opencode' ? mapOpenCodeError(error) : error;
    }
  }

  const completion = await provider.complete(prompt, {
    model,
    system: opts?.system,
    maxTokens: opts?.maxTokens,
  });
  return parseStructuredCompletion(
    {
      text: completion.text,
      model: completion.model,
      provider: completion.providerId,
      durationMs: completion.durationMs,
      promptTokens: completion.promptTokens,
      completionTokens: completion.completionTokens,
    },
    schema,
  );
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

export { LlmStructuredOutputError } from './structured-output.js';
export type { LlmObjectResult } from './structured-output.js';
export {
  lmStudioListModelDetails,
  lmStudioListModels,
  ollamaGetModelContextLength,
  ollamaListModelDetails,
  ollamaListModels,
  openCodeListModelDetails,
  openCodeListModels,
};
export type { LlmCompleteResult, LlmImageInput, LlmProgress, LlmProviderId, ModelTier, TaskType };
