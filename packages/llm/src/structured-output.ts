import type { LlmProviderId } from './types.js';

/**
 * LLAAB-owned structured-output types (Fable migration A4, migration doc Phase 4). Consumers
 * depend on these and on Zod schemas only — AI SDK types stay private to @llaab/llm.
 */

/** Result of `routeLlmObject`: typed data plus the same provider/model/usage metadata as `routeLlm`. */
export interface LlmObjectResult<OBJECT> {
  object: OBJECT;
  /** The raw model text the object was derived from — preserved for diagnostics and repair paths. */
  rawText: string;
  model: string;
  provider: LlmProviderId;
  durationMs: number;
  promptTokens?: number;
  completionTokens?: number;
}

/**
 * Thrown when a model response cannot be turned into a schema-valid object. Carries the raw
 * model text so callers keep access to the original output when structured generation fails.
 */
export class LlmStructuredOutputError extends Error {
  readonly rawText?: string;
  readonly provider: LlmProviderId;
  readonly model: string;

  constructor(
    message: string,
    args: { provider: LlmProviderId; model: string; rawText?: string; cause?: unknown },
  ) {
    super(message, args.cause === undefined ? undefined : { cause: args.cause });
    this.name = 'LlmStructuredOutputError';
    this.provider = args.provider;
    this.model = args.model;
    this.rawText = args.rawText;
  }
}

/**
 * Extracts a JSON object payload from model text that may wrap it in code fences or prose.
 * Local models routinely fence JSON; this keeps the fallback path deterministic. Returns
 * undefined when no object-shaped payload is present (object roots only — array roots are not
 * supported by the structured-output boundary).
 */
export function extractJsonObjectPayload(text: string): string | undefined {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) return undefined;
  return candidate.slice(start, end + 1);
}
