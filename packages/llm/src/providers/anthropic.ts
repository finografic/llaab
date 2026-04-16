import Anthropic from '@anthropic-ai/sdk';
import type { LlmCompleteOptions } from '../types.js';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] });
  }
  return client;
}

export async function anthropicComplete(prompt: string, opts: LlmCompleteOptions): Promise<string> {
  const response = await getClient().messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 1024,
    ...(opts.system && { system: opts.system }),
    messages: [{ role: 'user', content: prompt }],
  });

  const block = response.content[0];
  if (block?.type !== 'text') throw new Error('Unexpected response type from Anthropic');
  return block.text;
}

export async function* anthropicStream(prompt: string, opts: LlmCompleteOptions): AsyncGenerator<string> {
  const stream = getClient().messages.stream({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 1024,
    ...(opts.system && { system: opts.system }),
    messages: [{ role: 'user', content: prompt }],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}
