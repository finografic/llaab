import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { handleLlmComplete, handleLlmModels, handleLlmStream } from './llm.handlers.js';
import { completeLlmBodySchema } from './llm.routes.js';

export const llmRouter = new Hono();

llmRouter.post('/complete', zValidator('json', completeLlmBodySchema), handleLlmComplete);
llmRouter.post('/stream', zValidator('json', completeLlmBodySchema), handleLlmStream);
llmRouter.get('/models', handleLlmModels);
