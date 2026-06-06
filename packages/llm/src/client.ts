import { anthropicComplete } from './providers/anthropic.js';
import { ollamaComplete } from './providers/ollama.js';

export type LlmProvider = 'ollama' | 'anthropic';

export async function summarizeText(input: string, provider: LlmProvider = 'ollama'): Promise<string> {
  const opts = { model: provider === 'anthropic' ? 'claude-sonnet-4-6' : 'llama3.1:8b' };
  if (provider === 'anthropic') {
    return (await anthropicComplete(input, opts)).text;
  }
  return (await ollamaComplete(input, opts)).text;
}
