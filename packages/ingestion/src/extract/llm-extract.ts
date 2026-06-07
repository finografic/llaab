import { execute } from '@llaab/control';
import { resolveLlmRoute, routeLlm } from '@llaab/llm';
import { z } from 'zod';
import type { ControlDecision, ControlLlmTrace, ControlStage } from '@llaab/control';

import { prepareExtractionInput } from './harness-prep.js';

export interface ExtractedKnowledge {
  ideas: string[];
  skills: string[];
  summary: string;
  tags: string[];
}

export interface ExtractionRunTrace {
  stages: ControlStage[];
  decisions: ControlDecision[];
  llm?: ControlLlmTrace;
}

export interface LlmExtractionMeta {
  model: string;
  provider: string;
  durationMs: number;
  promptTokens?: number;
  completionTokens?: number;
}

export interface ExtractedKnowledgeWithTrace extends ExtractedKnowledge {
  runTrace: ExtractionRunTrace;
  llmMeta: LlmExtractionMeta;
}

const ExtractedKnowledgeSchema = z.object({
  ideas: z.array(z.string()),
  skills: z.array(z.string()),
  summary: z.string().min(1),
  tags: z.array(z.string()).min(1),
});

const EXTRACTION_SYSTEM_PROMPT = `You are a knowledge extraction assistant. Analyze the provided content and extract structured knowledge.

Return ONLY a valid JSON object with exactly these four fields:
- "ideas": array of distinct insights, concepts, or takeaways as concise phrases (5–15 words each)
- "skills": array of specific techniques, tools, methods, or practices mentioned
- "summary": a single sentence (max 30 words) summarising the core topic
- "tags": array of 2–5 concise topic tags (1–3 words each, lowercase, hyphenated) describing the specific subjects covered. These are content tags, not domain categories. Good tags name concrete topics: "open-weight-models", "edge-inference", "multimodal", "gemma-4", "context-window". Bad tags are vague categories: "ai", "technology", "interesting".

Rules:
- Output raw JSON only — no markdown fences, no explanation, no commentary
- ideas array must have at least 1 item if the content is substantive
- Every string must be plain text with no nested quotes
- The example below illustrates FORMAT ONLY, using a topic unrelated to typical input — never copy its
  wording or tags; every field must be derived from the actual input content

Example output format:
{"ideas":["Slow-roasting at low heat keeps tougher cuts of meat moist","Resting meat after cooking redistributes its juices evenly"],"skills":["dry brining","reverse searing","probe thermometry"],"summary":"Techniques for cooking tender, evenly-seasoned roasts at home.","tags":["reverse-sear","dry-brine","meat-thermometer","roasting-technique"]}`;

function parseJsonFromText(text: string): unknown {
  // Strip optional markdown code fences (```json ... ``` or ``` ... ```)
  const stripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  // Find the first { … } block in case the model added preamble
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in LLM response');
  return JSON.parse(stripped.slice(start, end + 1));
}

function dedupeValues(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.trim().toLocaleLowerCase();
    if (key.length === 0 || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeContentTags(tags: string[]): string[] {
  return dedupeValues(
    tags
      .map((tag) =>
        tag
          .toLocaleLowerCase()
          .trim()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, ''),
      )
      .filter((tag) => tag.length > 0),
  );
}

function reduceChunkedExtraction(parts: ExtractedKnowledge[]): ExtractedKnowledge {
  if (parts.length === 1) {
    return {
      ...parts[0],
      tags: normalizeContentTags(parts[0]?.tags ?? []),
    } as ExtractedKnowledge;
  }

  return {
    ideas: dedupeValues(parts.flatMap((part) => part.ideas)),
    skills: dedupeValues(parts.flatMap((part) => part.skills)),
    summary: dedupeValues(parts.map((part) => part.summary)).join(' '),
    tags: normalizeContentTags(parts.flatMap((part) => part.tags)),
  };
}

function addOptionalTokenCount(left: number | undefined, right: number | undefined): number | undefined {
  if (left === undefined && right === undefined) return undefined;
  return (left ?? 0) + (right ?? 0);
}

export async function llmExtractWithTrace(input: string): Promise<ExtractedKnowledgeWithTrace> {
  const route = resolveLlmRoute('extract');
  const prepared = await prepareExtractionInput({
    cwd: process.cwd(),
    input,
    model: route.model,
  });
  let llmMeta: LlmExtractionMeta | undefined;
  const controlled = await execute({
    task: 'extract-knowledge',
    input: {
      chunkCount: prepared.chunks.length,
      model: prepared.model,
      text: prepared.preparedText,
    },
    schema: ExtractedKnowledgeSchema,
    context: prepared.context,
    policy: {
      maxRetries: 1,
      onInvalid: 'retry',
      onFailure: 'retry',
    },
    model: 'extract',
    run: async () => {
      let nextLlmMeta: LlmExtractionMeta | undefined;
      const chunkResults: ExtractedKnowledge[] = [];
      for (const chunk of prepared.chunks) {
        const prompt =
          prepared.chunks.length === 1
            ? chunk.text
            : `[chunk ${chunk.index + 1}/${prepared.chunks.length}]\n\n${chunk.text}`;
        const result = await routeLlm('extract', prompt, {
          model: prepared.model,
          system: EXTRACTION_SYSTEM_PROMPT,
        });
        nextLlmMeta = {
          model: result.model,
          provider: result.provider,
          durationMs: (nextLlmMeta?.durationMs ?? 0) + result.durationMs,
          promptTokens: addOptionalTokenCount(nextLlmMeta?.promptTokens, result.promptTokens),
          completionTokens: addOptionalTokenCount(nextLlmMeta?.completionTokens, result.completionTokens),
        };
        chunkResults.push(ExtractedKnowledgeSchema.parse(parseJsonFromText(result.text)));
      }

      llmMeta = nextLlmMeta;
      return reduceChunkedExtraction(chunkResults);
    },
  });
  if (!llmMeta) throw new Error('LLM extraction completed without metadata');

  const llmTrace: ControlLlmTrace | undefined = controlled.llm
    ? {
        ...controlled.llm,
        model: llmMeta.model,
        provider: llmMeta.provider,
        duration_ms: llmMeta.durationMs,
        prompt_tokens: llmMeta.promptTokens,
        completion_tokens: llmMeta.completionTokens,
      }
    : undefined;

  return {
    ...controlled.data,
    llmMeta,
    runTrace: {
      stages: [
        ...prepared.stages,
        {
          name: 'control:extract-knowledge',
          status: 'completed',
          input,
          output: controlled.data,
        },
      ],
      decisions: controlled.decisions,
      llm: llmTrace,
    },
  };
}

export async function llmExtract(input: string): Promise<ExtractedKnowledge> {
  const { runTrace: _runTrace, ...data } = await llmExtractWithTrace(input);
  return data;
}
