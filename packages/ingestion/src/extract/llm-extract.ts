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

export async function llmExtractWithTrace(input: string): Promise<ExtractedKnowledgeWithTrace> {
  const controlled = await execute({
    task: 'extract-knowledge',
    input,
    schema: ExtractedKnowledgeSchema,
    context: {
      instructions: 'Return structured extracted knowledge.',
      data: input,
      constraints: ['summary must be non-empty'],
    },
    policy: {
      maxRetries: 0,
      onInvalid: 'reject',
      onFailure: 'reject',
    },
    model: 'ollama',
    run: async () => {
      const { text } = await routeLlm('extract', input);

      return {
        ideas: [],
        skills: [],
        summary: text,
      };
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
