import type { LlmCompleteOptions, LlmCompleteResult, ModelTier, TaskType } from './types.js';

import { cacheGet, cacheSet } from './cache.js';
import { anthropicComplete, anthropicStream } from './providers/anthropic.js';
import { ollamaComplete, ollamaListModels, ollamaStream } from './providers/ollama.js';

// ── Tier → model name (env-configurable) ─────────────────────────────────────

const MODEL_MAP: Record<ModelTier, string> = {
  'local-small': process.env['LLAAB_LOCAL_SMALL_MODEL'] ?? 'llama3.2:3b',
  'local-mid': process.env['LLAAB_LOCAL_MID_MODEL'] ?? 'llama3.1:8b',
  'remote': process.env['LLAAB_REMOTE_MODEL'] ?? 'claude-sonnet-4-6',
};

// ── Task → tier ───────────────────────────────────────────────────────────────

const ROUTING: Record<TaskType, ModelTier> = {
  format: 'local-small',
  extract: 'local-mid',
  code: 'local-mid',
  reason: 'remote',
};

// ── Cacheable tasks ───────────────────────────────────────────────────────────

const CACHEABLE = new Set<TaskType>(['format', 'extract']);

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveModel(task: TaskType, override?: string): { model: string; tier: ModelTier } {
  const tier = ROUTING[task];
  return { model: override ?? MODEL_MAP[tier], tier };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function routeLlm(
  task: TaskType,
  prompt: string,
  opts?: { model?: string; system?: string; maxTokens?: number },
): Promise<LlmCompleteResult> {
  const { model, tier } = resolveModel(task, opts?.model);
  const completeOpts: LlmCompleteOptions = { model, system: opts?.system, maxTokens: opts?.maxTokens };

  if (CACHEABLE.has(task)) {
    const hit = cacheGet(prompt, model);
    if (hit) return { text: hit, model, cached: true };
  }

  const text =
    tier === 'remote'
      ? await anthropicComplete(prompt, completeOpts)
      : await ollamaComplete(prompt, completeOpts);

  if (CACHEABLE.has(task)) cacheSet(prompt, model, text);

  return { text, model, cached: false };
}

export async function* streamLlm(
  task: TaskType,
  prompt: string,
  opts?: { model?: string; system?: string; maxTokens?: number },
): AsyncGenerator<string> {
  const { model, tier } = resolveModel(task, opts?.model);
  const completeOpts: LlmCompleteOptions = { model, system: opts?.system, maxTokens: opts?.maxTokens };

  if (tier === 'remote') {
    yield* anthropicStream(prompt, completeOpts);
  } else {
    yield* ollamaStream(prompt, completeOpts);
  }
}

export { ollamaListModels };
export type { LlmCompleteResult, ModelTier, TaskType };
