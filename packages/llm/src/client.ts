import { anthropicComplete } from './providers/anthropic.js';
import { lmStudioComplete } from './providers/lmstudio.js';
import { ollamaComplete } from './providers/ollama.js';

export type LlmProviderId = 'ollama' | 'anthropic' | 'lmstudio';

export async function summarizeText(input: string, provider: LlmProviderId = 'ollama'): Promise<string> {
  const opts = { model: provider === 'anthropic' ? 'claude-sonnet-4-6' : 'llama3.1:8b' };
  if (provider === 'anthropic') {
    return (await anthropicComplete(input, opts)).text;
  }
  if (provider === 'lmstudio') {
    return (
      await lmStudioComplete(input, {
        model: process.env['LLAAB_LMSTUDIO_MODEL'] ?? 'google/gemma-4-e4b',
      })
    ).text;
  }
  return (await ollamaComplete(input, opts)).text;
}
