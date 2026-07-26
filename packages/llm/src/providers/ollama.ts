import { Ollama } from 'ollama';
import type { LlmProvider, LlmProviderResult } from '../provider.js';
import type { LlmCompleteOptions, LlmImageInput } from '../types.js';

export interface OllamaModelDetails {
  families?: string[];
  family?: string;
  format?: string;
  parameter_size?: string;
  parent_model?: string;
  quantization_level?: string;
}

export interface OllamaModelInfo {
  digest?: string;
  details?: OllamaModelDetails;
  modified_at?: Date | string;
  name: string;
  size?: number;
  /** Native capability flags reported by `ollama show` (e.g. "vision", "tools", "thinking"). */
  capabilities?: string[];
  /** Context window size, read from the model's architecture-specific `*.context_length`. */
  contextLength?: number;
}

let client: Ollama | null = null;

function getClient(): Ollama {
  if (!client) {
    client = new Ollama({ host: process.env['OLLAMA_HOST'] ?? 'http://localhost:11434' });
  }
  return client;
}

function buildMessages(prompt: string, system?: string) {
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });
  return messages;
}

function buildImageMessages(prompt: string, image: LlmImageInput, system?: string) {
  const messages: Array<{ role: 'system' | 'user'; content: string; images?: string[] }> = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt, images: [image.base64] });
  return messages;
}

/**
 * Ollama defaults `num_ctx` to 4096 regardless of a model's native context window. Smaller
 * models tend to be more verbose and can fill that window before finishing a JSON response,
 * producing truncated/unparseable output. Request a larger window so completions have room
 * to finish.
 */
const DEFAULT_NUM_CTX = 16384;

export async function ollamaComplete(prompt: string, opts: LlmCompleteOptions): Promise<LlmProviderResult> {
  const start = performance.now();
  const response = await getClient().chat({
    model: opts.model,
    messages: buildMessages(prompt, opts.system),
    stream: false,
    options: {
      num_ctx: DEFAULT_NUM_CTX,
      ...(opts.maxTokens ? { num_predict: opts.maxTokens } : {}),
    },
  });
  return {
    text: response.message.content,
    durationMs: Math.round(performance.now() - start),
    providerId: 'ollama',
    model: opts.model,
    promptTokens: response.prompt_eval_count,
    completionTokens: response.eval_count,
  };
}

export async function ollamaCompleteWithImage(
  prompt: string,
  image: LlmImageInput,
  opts: LlmCompleteOptions,
): Promise<LlmProviderResult> {
  const start = performance.now();
  const response = await getClient().chat({
    model: opts.model,
    messages: buildImageMessages(prompt, image, opts.system),
    stream: false,
    format: 'json',
    options: {
      num_ctx: DEFAULT_NUM_CTX,
      ...(opts.maxTokens ? { num_predict: opts.maxTokens } : {}),
    },
  });
  return {
    text: response.message.content,
    durationMs: Math.round(performance.now() - start),
    providerId: 'ollama',
    model: opts.model,
    promptTokens: response.prompt_eval_count,
    completionTokens: response.eval_count,
  };
}

export async function* ollamaStream(prompt: string, opts: LlmCompleteOptions): AsyncGenerator<string> {
  const stream = await getClient().chat({
    model: opts.model,
    messages: buildMessages(prompt, opts.system),
    stream: true,
    options: {
      num_ctx: DEFAULT_NUM_CTX,
      ...(opts.maxTokens ? { num_predict: opts.maxTokens } : {}),
    },
  });

  for await (const chunk of stream) {
    if (chunk.message?.content) yield chunk.message.content;
  }
}

export async function ollamaListModels(): Promise<string[]> {
  const { models } = await getClient().list();
  return models.map((m) => m.name);
}

/** Formats a raw `general.parameter_count` value (e.g. 27_400_000_000) as "27.4B". */
function formatParameterCount(value: unknown): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  const billions = value / 1_000_000_000;
  return `${billions.toFixed(billions >= 10 ? 0 : 1)}B`;
}

function deriveContextLength(modelInfo: Record<string, unknown> | undefined): number | undefined {
  const architecture = modelInfo?.['general.architecture'] as string | undefined;
  if (!architecture || !modelInfo) return undefined;
  const contextLength = modelInfo[`${architecture}.context_length`];
  return typeof contextLength === 'number' ? contextLength : undefined;
}

export async function ollamaListModelDetails(): Promise<OllamaModelInfo[]> {
  const { models } = await getClient().list();
  return Promise.all(
    models.map(async (model) => {
      const show = await getClient()
        .show({ model: model.name })
        .catch(() => undefined);
      const modelInfo = show?.model_info as unknown as Record<string, unknown> | undefined;
      const architecture = modelInfo?.['general.architecture'] as string | undefined;

      return {
        digest: model.digest,
        details: {
          ...model.details,
          family: model.details?.family || show?.details?.family || architecture,
          parameter_size:
            model.details?.parameter_size ||
            show?.details?.parameter_size ||
            formatParameterCount(modelInfo?.['general.parameter_count']),
        },
        modified_at: model.modified_at,
        name: model.name,
        size: model.size,
        capabilities: show?.capabilities,
        contextLength: deriveContextLength(modelInfo),
      };
    }),
  );
}

const contextLengthCache = new Map<string, number | undefined>();

/**
 * Looks up a model's native context window via `ollama show`, caching results for the life of
 * the process — harness extraction prep calls this once per run to size token budgets.
 */
export async function ollamaGetModelContextLength(model: string): Promise<number | undefined> {
  if (contextLengthCache.has(model)) return contextLengthCache.get(model);

  const contextLength = await getClient()
    .show({ model })
    .then((show) => deriveContextLength(show.model_info as unknown as Record<string, unknown> | undefined))
    .catch(() => undefined);

  contextLengthCache.set(model, contextLength);
  return contextLength;
}

export const ollamaProvider: LlmProvider = {
  id: 'ollama',
  displayName: 'Ollama',
  capabilities: ['chat', 'summarize', 'extract', 'reduce', 'structure'],
  complete: ollamaComplete,
  completeWithImage: ollamaCompleteWithImage,
  stream: ollamaStream,
  async isAvailable() {
    try {
      await ollamaListModelDetails();
      return true;
    } catch {
      return false;
    }
  },
};
