import { summarizeText } from '@llaab/llm';

export interface ExtractedKnowledge {
  ideas: string[];
  skills: string[];
  summary: string;
}

export async function llmExtract(input: string): Promise<ExtractedKnowledge> {
  const summary = await summarizeText(input);
  return {
    ideas: [],
    skills: [],
    summary,
  };
}
