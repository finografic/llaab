import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { handleAgentRun, handleAgentStatus } from './agent.handlers.js';
import { runAgentBodySchema } from './agent.routes.js';

export const agentRouter = new Hono();

agentRouter.post('/run', zValidator('json', runAgentBodySchema), handleAgentRun);
agentRouter.get('/status', handleAgentStatus);
