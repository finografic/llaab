import { anthropicComplete } from './providers/anthropic.js';
import { lmStudioComplete } from './providers/lmstudio.js';
import { ollamaComplete } from './providers/ollama.js';
import { openCodeComplete } from './providers/opencode.js';

export type LlmProviderId = 'ollama' | 'anthropic' | 'lmstudio' | 'opencode';

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
  if (provider === 'opencode') {
    return (
      await openCodeComplete(input, {
        model: process.env['OPENCODE_MODEL'] ?? 'qwen3.7-plus',
      })
    ).text;
  }
  return (await ollamaComplete(input, opts)).text;
}
