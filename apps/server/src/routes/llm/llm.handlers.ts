import { ollamaListModels, routeLlm, streamLlm } from '@llaab/llm';
import { streamSSE } from 'hono/streaming';
import { StatusCodes } from 'http-status-codes';
import type { CompleteLlmBody } from './llm.routes.js';
import type { Context } from 'hono';

export async function handleLlmComplete(c: Context) {
  const body = c.req.valid('json' as never) as CompleteLlmBody;

  try {
    const result = await routeLlm(body.task, body.prompt, {
      model: body.model,
      system: body.system,
      maxTokens: body.maxTokens,
    });
    return c.json(result);
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : 'LLM call failed' },
      StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
}

export function handleLlmStream(c: Context) {
  const body = c.req.valid('json' as never) as CompleteLlmBody;

  return streamSSE(c, async (stream) => {
    try {
      for await (const chunk of streamLlm(body.task, body.prompt, {
        model: body.model,
        system: body.system,
        maxTokens: body.maxTokens,
      })) {
        await stream.writeSSE({ data: chunk });
      }
      await stream.writeSSE({ data: '[DONE]' });
    } catch (err) {
      await stream.writeSSE({
        data: JSON.stringify({ error: err instanceof Error ? err.message : 'Stream failed' }),
        event: 'error',
      });
    }
  });
}

export async function handleLlmModels(c: Context) {
  try {
    const models = await ollamaListModels();
    return c.json({ models });
  } catch {
    return c.json({ models: [], error: 'Ollama unavailable' }, StatusCodes.SERVICE_UNAVAILABLE);
  }
}
