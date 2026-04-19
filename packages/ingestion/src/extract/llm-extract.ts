import { execute } from '@llaab/control';
import { routeLlm } from '@llaab/llm';
import { z } from 'zod';
import type { ControlDecision, ControlLlmTrace, ControlStage } from '@llaab/control';

export interface ExtractedKnowledge {
  ideas: string[];
  skills: string[];
  summary: string;
}

export interface ExtractionRunTrace {
  stages: ControlStage[];
  decisions: ControlDecision[];
  llm?: ControlLlmTrace;
}

export interface ExtractedKnowledgeWithTrace extends ExtractedKnowledge {
  runTrace: ExtractionRunTrace;
}

const ExtractedKnowledgeSchema = z.object({
  ideas: z.array(z.string()),
  skills: z.array(z.string()),
  summary: z.string().min(1),
});

const EXTRACTION_SYSTEM_PROMPT = `You are a knowledge extraction assistant. Analyze the provided content and extract structured knowledge.

Return ONLY a valid JSON object with exactly these three fields:
- "ideas": array of distinct insights, concepts, or takeaways as concise phrases (5–15 words each)
- "skills": array of specific techniques, tools, methods, or practices mentioned
- "summary": a single sentence (max 30 words) summarising the core topic

Rules:
- Output raw JSON only — no markdown fences, no explanation, no commentary
- ideas array must have at least 1 item if the content is substantive
- Every string must be plain text with no nested quotes

Example output format:
{"ideas":["Large language models require careful prompt engineering","Fine-tuning outperforms prompting for narrow tasks"],"skills":["prompt engineering","model fine-tuning","RLHF"],"summary":"Overview of LLM training and deployment strategies."}`;

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

// ~6 000 chars leaves room for the system prompt + JSON response within an 8k token window
const MAX_INPUT_CHARS = 6_000;

function truncateForExtraction(text: string): string {
  if (text.length <= MAX_INPUT_CHARS) return text;
  return text.slice(0, MAX_INPUT_CHARS) + '\n\n[transcript truncated for extraction]';
}

export async function llmExtractWithTrace(input: string): Promise<ExtractedKnowledgeWithTrace> {
  const truncated = truncateForExtraction(input);
  const controlled = await execute({
    task: 'extract-knowledge',
    input: truncated,
    schema: ExtractedKnowledgeSchema,
    context: {
      instructions: 'Return structured extracted knowledge as JSON.',
      data: truncated,
      constraints: ['summary must be non-empty', 'output must be valid JSON'],
    },
    policy: {
      maxRetries: 1,
      onInvalid: 'retry',
      onFailure: 'retry',
    },
    model: 'ollama',
    run: async () => {
      const { text } = await routeLlm('extract', truncated, { system: EXTRACTION_SYSTEM_PROMPT });
      return parseJsonFromText(text);
    },
  });

  return {
    ...controlled.data,
    runTrace: {
      stages: [
        {
          name: 'control:extract-knowledge',
          status: 'completed',
          input,
          output: controlled.data,
        },
      ],
      decisions: controlled.decisions,
      llm: controlled.llm,
    },
  };
}

export async function llmExtract(input: string): Promise<ExtractedKnowledge> {
  const { runTrace: _runTrace, ...data } = await llmExtractWithTrace(input);
  return data;
}
