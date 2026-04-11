import { execute } from '@llaab/control';
import { summarizeText } from '@llaab/llm';
import { z } from 'zod';

export interface ExtractedKnowledge {
  ideas: string[];
  skills: string[];
  summary: string;
}

const ExtractedKnowledgeSchema = z.object({
  ideas: z.array(z.string()),
  skills: z.array(z.string()),
  summary: z.string().min(1),
});

export async function llmExtract(input: string): Promise<ExtractedKnowledge> {
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
      const summary = await summarizeText(input);

      return {
        ideas: [],
        skills: [],
        summary,
      };
    },
  });

  return controlled.data;
}
