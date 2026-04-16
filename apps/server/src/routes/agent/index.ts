import { zValidator } from '@hono/zod-validator';
import { getAgentStatus, runAgentLoop } from '@llaab/skills';

import { createRouter } from '../../lib/create-app.js';
import { runAgentBodySchema } from './agent.routes.js';

export const agentRouter = createRouter()
  .post('/run', zValidator('json', runAgentBodySchema), async (c) => {
    const body = c.req.valid('json');
    try {
      const summary = await runAgentLoop({ nodeId: body.nodeId, force: body.force });
      return c.json(summary);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Agent loop failed' }, 500);
    }
  })
  .get('/status', async (c) => {
    try {
      const status = await getAgentStatus();
      return c.json(status);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Could not read agent status' }, 500);
    }
  });
