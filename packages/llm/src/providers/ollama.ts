import { Ollama } from 'ollama';
import type { LlmProvider, LlmProviderResult } from '../provider.js';
import type { LlmCompleteOptions } from '../types.js';

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

export async function ollamaComplete(prompt: string, opts: LlmCompleteOptions): Promise<LlmProviderResult> {
  const start = performance.now();
  const response = await getClient().chat({
    model: opts.model,
    messages: buildMessages(prompt, opts.system),
    stream: false,
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

export async function ollamaListModelDetails(): Promise<OllamaModelInfo[]> {
  const { models } = await getClient().list();
  return Promise.all(
    models.map(async (model) => {
      const show = await getClient()
        .show({ model: model.name })
        .catch(() => undefined);
      const modelInfo = show?.model_info as Record<string, unknown> | undefined;
      const architecture = modelInfo?.['general.architecture'] as string | undefined;
      const contextLength = architecture
        ? (modelInfo?.[`${architecture}.context_length`] as number | undefined)
        : undefined;

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
        contextLength: typeof contextLength === 'number' ? contextLength : undefined,
      };
    }),
  );
}

export const ollamaProvider: LlmProvider = {
  id: 'ollama',
  displayName: 'Ollama',
  capabilities: ['chat', 'summarize', 'extract', 'reduce', 'structure'],
  complete: ollamaComplete,
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
