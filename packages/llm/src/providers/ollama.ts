import { Ollama } from 'ollama';
import type { LlmCompleteOptions } from '../types.js';

let client: Ollama | null = null;

function getClient(): Ollama {
  if (!client) {
    client = new Ollama({ host: process.env['OLLAMA_HOST'] ?? 'http://localhost:11434' });
  }
  return client;
}

export async function ollamaComplete(prompt: string, opts: LlmCompleteOptions): Promise<string> {
  const response = await getClient().generate({
    model: opts.model,
    prompt: opts.system ? `${opts.system}\n\n${prompt}` : prompt,
    stream: false,
  });
  return response.response;
}

export async function* ollamaStream(prompt: string, opts: LlmCompleteOptions): AsyncGenerator<string> {
  const stream = await getClient().generate({
    model: opts.model,
    prompt: opts.system ? `${opts.system}\n\n${prompt}` : prompt,
    stream: true,
  });

  for await (const chunk of stream) {
    if (chunk.response) yield chunk.response;
  }
}

export async function ollamaListModels(): Promise<string[]> {
  const { models } = await getClient().list();
  return models.map((m) => m.name);
}
