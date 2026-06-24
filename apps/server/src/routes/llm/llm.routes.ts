import {
  getLlmStatus,
  lmStudioListModelDetails,
  lmStudioListModels,
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
    const models: Array<{ model: string; provider: 'ollama' | 'lmstudio' }> = [];
    const errors: Partial<Record<'ollama' | 'lmstudio', string>> = {};

    try {
      models.push(...(await ollamaListModels()).map((model) => ({ model, provider: 'ollama' as const })));
    } catch {
      errors.ollama = 'Ollama unavailable';
    }

    try {
      models.push(...(await lmStudioListModels()).map((model) => ({ model, provider: 'lmstudio' as const })));
    } catch {
      errors.lmstudio = 'LM Studio unavailable';
    }

    const statusCode = models.length > 0 ? 200 : 503;
    return c.json({ models: models.map((entry) => entry.model), modelOptions: models, errors }, statusCode);
  },
};

export const status = {
  path: '/status' as const,
  handler: async (c: AppCtx) => {
    const config = await getLlmStatus();
    let installedModels: string[] = [];
    let installedModelDetails: Awaited<ReturnType<typeof ollamaListModelDetails>> = [];
    let lmStudioModelDetails: Awaited<ReturnType<typeof lmStudioListModelDetails>> = [];
    let ollamaError: string | undefined;
    let lmStudioError: string | undefined;
    try {
      installedModelDetails = await ollamaListModelDetails();
      installedModels = installedModelDetails.map((model) => model.name);
    } catch {
      ollamaError = 'Ollama unavailable';
    }

    try {
      lmStudioModelDetails = await lmStudioListModelDetails();
      installedModels = [...installedModels, ...lmStudioModelDetails.map((model) => model.name)];
    } catch {
      lmStudioError = 'LM Studio unavailable';
    }

    const installedModelOptions = [
      ...installedModelDetails.map((model) => ({ model: model.name, provider: 'ollama' as const })),
      ...lmStudioModelDetails.map((model) => ({ model: model.name, provider: 'lmstudio' as const })),
    ];

    return c.json({
      availableProviders: config.availableProviders,
      modelMap: config.modelMap,
      routing: config.routing,
      installedModels,
      installedModelOptions,
      installedModelDetails: [
        ...installedModelDetails.map((model) => ({ ...model, provider: 'ollama' as const })),
        ...lmStudioModelDetails,
      ],
      ollamaError,
      lmStudioError,
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
