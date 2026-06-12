import {
  getLlmStatus,
  ollamaListModelDetails,
  ollamaListModels,
  routeLlm,
  streamLlm,
  updateLlmTaskRoute,
} from '@llaab/llm';
import { streamSSE } from 'hono/streaming';
import type { AppCtx, AppCtxJson } from '../../types/app.types.js';
import type { CompleteLlmBody, UpdateLlmRouteBody } from './llm.schema.js';

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

export const status = {
  path: '/status' as const,
  handler: async (c: AppCtx) => {
    const config = await getLlmStatus();
    let installedModels: string[] = [];
    let installedModelDetails: Awaited<ReturnType<typeof ollamaListModelDetails>> = [];
    let ollamaError: string | undefined;
    try {
      installedModelDetails = await ollamaListModelDetails();
      installedModels = installedModelDetails.map((model) => model.name);
    } catch {
      ollamaError = 'Ollama unavailable';
    }
    return c.json({
      availableProviders: config.availableProviders,
      modelMap: config.modelMap,
      routing: config.routing,
      installedModels,
      installedModelDetails,
      ollamaError,
    });
  },
};

export const updateRouting = {
  path: '/routing' as const,
  handler: async (c: AppCtxJson<UpdateLlmRouteBody>) => {
    const body = c.req.valid('json');
    const routing = updateLlmTaskRoute(body.task, {
      model: body.model,
      tier: body.tier,
      provider: body.provider,
    });

    return c.json({ routing });
  },
};

export const capabilities = {
  path: '/capabilities' as const,
  handler: async (c: AppCtx) => {
    const config = await getLlmStatus();
    return c.json({ providers: config.capabilities });
  },
};
