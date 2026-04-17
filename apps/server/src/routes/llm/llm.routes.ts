import { ollamaListModels, routeLlm, streamLlm } from '@llaab/llm';
import { streamSSE } from 'hono/streaming';
import type { AppCtx, AppCtxJson } from '../../types/app.types.js';
import type { CompleteLlmBody } from './llm.schema.js';

export const complete = {
  path: '/complete' as const,
  handler: async (c: AppCtxJson<CompleteLlmBody>) => {
    const body = c.req.valid('json');
    try {
      const result = await routeLlm(body.task, body.prompt, {
        model: body.model,
        system: body.system,
        maxTokens: body.maxTokens,
      });
      return c.json(result);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'LLM call failed' }, 500);
    }
  },
};

export const stream = {
  path: '/stream' as const,
  handler: (c: AppCtxJson<CompleteLlmBody>) => {
    const body = c.req.valid('json');
    return streamSSE(c, async (sseStream) => {
      try {
        for await (const chunk of streamLlm(body.task, body.prompt, {
          model: body.model,
          system: body.system,
          maxTokens: body.maxTokens,
        })) {
          await sseStream.writeSSE({ data: chunk });
        }
        await sseStream.writeSSE({ data: '[DONE]' });
      } catch (err) {
        await sseStream.writeSSE({
          data: JSON.stringify({ error: err instanceof Error ? err.message : 'Stream failed' }),
          event: 'error',
        });
      }
    });
  },
};

export const models = {
  path: '/models' as const,
  handler: async (c: AppCtx) => {
    try {
      const modelList = await ollamaListModels();
      return c.json({ models: modelList });
    } catch {
      return c.json({ models: [] as string[], error: 'Ollama unavailable' }, 503);
    }
  },
};
