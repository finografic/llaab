import { summarizeWithAnthropic } from './providers/anthropic.js';
import { summarizeWithOllama } from './providers/ollama.js';

export type LlmProvider = 'ollama' | 'anthropic';

export async function summarizeText(input: string, provider: LlmProvider = 'ollama'): Promise<string> {
  if (provider === 'anthropic') {
    return summarizeWithAnthropic(input);
  }
  return summarizeWithOllama(input);
}
