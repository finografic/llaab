import { execute } from '@llaab/control';
import { invalidateLlmCache, resolveLlmRoute, routeLlm } from '@llaab/llm';
import { z } from 'zod';
import type { ControlDecision, ControlLlmTrace, ControlStage } from '@llaab/control';

import { prepareExtractionInput } from './harness-prep.js';

export interface ExtractedKnowledge {
  ideas: ExtractedIdea[];
  skills: string[];
  summary: string;
  tags: string[];
}

export interface ExtractedIdea {
  title: string;
  domainTags: string[];
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

const ExtractedIdeaSchema = z.union([
  z.string().transform((title) => ({ title, domainTags: [], tags: [] })),
  z
    .object({
      title: z.string(),
      domainTags: z.array(z.string()).default([]),
      domain_tags: z.array(z.string()).default([]),
      // "topic_tags" is the current prompt field name; "tags" accepted for cached/legacy responses
      topic_tags: z.array(z.string()).default([]),
      tags: z.array(z.string()).default([]),
    })
    .transform((idea) => ({
      title: idea.title,
      domainTags: idea.domainTags.length > 0 ? idea.domainTags : idea.domain_tags,
      tags: idea.topic_tags.length > 0 ? idea.topic_tags : idea.tags,
    })),
]);

const ExtractedKnowledgeSchema = z.object({
  ideas: z.array(ExtractedIdeaSchema),
  skills: z.array(z.string()),
  summary: z.string().min(1),
  tags: z.array(z.string()).min(1),
});

const EXTRACTION_SYSTEM_PROMPT = `You are a knowledge extraction assistant. Analyze the provided content and extract structured knowledge.

Return ONLY a valid JSON object with exactly these four fields:
- "ideas": array of distinct insights, concepts, or takeaways. Each item must be an object with:
  - "title": concise phrase (5–15 words)
  - "domain_tags": 0–3 domain tags that apply to this idea only, chosen only from: d:llm, d:automation, d:ingest, d:schema, d:infra, d:integration, d:ui, d:meta
  - "topic_tags": 1–3 concise topic tags that apply to this idea only. These are content tags, not domain categories.
- "skills": array of specific techniques, tools, methods, or practices mentioned
- "summary": a single sentence (max 30 words) summarising the core topic
- "tags": array of 2–5 concise topic tags (1–3 words each, lowercase, hyphenated) describing the overall subjects covered. These are content tags, not domain categories. Good tags name concrete topics: "open-weight-models", "edge-inference", "multimodal", "gemma-4", "context-window". Bad tags are vague categories: "ai", "technology", "interesting".

Rules:
- Output raw JSON only — no markdown fences, no explanation, no commentary
- ideas array must have at least 1 item if the content is substantive
- Domain tags may repeat across ideas when several ideas share the same broad domain
- Topic tags (inside each idea) should be specific to that idea and vary more than domain tags
- The root-level "tags" field describes the overall content; per-idea "topic_tags" describe individual ideas
- Every string must be plain text with no nested quotes
- The example below illustrates JSON shape only — never copy its placeholder wording or tags

Example output format:
{"ideas":[{"title":"First specific extracted idea from the input","domain_tags":["d:llm"],"topic_tags":["specific-topic-one","specific-method"]},{"title":"Second specific extracted idea from the input","domain_tags":["d:automation"],"topic_tags":["specific-topic-two"]}],"skills":["specific technique"],"summary":"Single-sentence summary derived from the input.","tags":["overall-topic","specific-tool"]}`;

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

export function normalizeDomainTags(tags: string[]): string[] {
  return dedupeValues(
    tags
      .map((tag) => tag.toLocaleLowerCase().trim().replace(/\s+/g, '-'))
      .filter((tag) => /^d:[a-z0-9-]+$/.test(tag)),
  );
}

function normalizeExtractedIdeas(ideas: ExtractedIdea[]): ExtractedIdea[] {
  const seen = new Set<string>();
  const normalizedIdeas: ExtractedIdea[] = [];

  for (const idea of ideas) {
    const title = idea.title.trim();
    const key = title.toLocaleLowerCase();
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    normalizedIdeas.push({
      title,
      domainTags: normalizeDomainTags(idea.domainTags),
      tags: normalizeContentTags(idea.tags),
    });
  }

  return normalizedIdeas;
}

function reduceChunkedExtraction(parts: ExtractedKnowledge[]): ExtractedKnowledge {
  if (parts.length === 1) {
    return {
      ...parts[0],
      ideas: normalizeExtractedIdeas(parts[0]?.ideas ?? []),
      tags: normalizeContentTags(parts[0]?.tags ?? []),
    } as ExtractedKnowledge;
  }

  return {
    ideas: normalizeExtractedIdeas(parts.flatMap((part) => part.ideas)),
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
        let json: unknown;
        try {
          json = parseJsonFromText(result.text);
        } catch (parseError) {
          // The model returned text with no parseable JSON object — evict it so retries
          // re-query the LLM instead of replaying the same unparsable cached response forever.
          invalidateLlmCache('extract', prompt, prepared.model);
          throw parseError;
        }

        const parsed = ExtractedKnowledgeSchema.safeParse(json);
        if (!parsed.success) {
          // The model returned schema-incompatible JSON — evict it so retries re-query
          // the LLM instead of replaying the same broken cached response forever.
          invalidateLlmCache('extract', prompt, prepared.model);
          throw parsed.error;
        }
        chunkResults.push(parsed.data);
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
