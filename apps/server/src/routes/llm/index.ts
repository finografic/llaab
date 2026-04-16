import { zValidator } from '@hono/zod-validator';
import { ollamaListModels, routeLlm, streamLlm } from '@llaab/llm';
import { streamSSE } from 'hono/streaming';

import { createRouter } from '../../lib/create-app.js';
import { completeLlmBodySchema } from './llm.routes.js';

export const llmRouter = createRouter()
  .post('/complete', zValidator('json', completeLlmBodySchema), async (c) => {
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
  })
  .post('/stream', zValidator('json', completeLlmBodySchema), (c) => {
    const body = c.req.valid('json');
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
  })
  .get('/models', async (c) => {
    try {
      const models = await ollamaListModels();
      return c.json({ models });
    } catch {
      return c.json({ models: [] as string[], error: 'Ollama unavailable' }, 503);
    }
  });
