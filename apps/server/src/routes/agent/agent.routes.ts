import { getAgentStatus, runAgentLoop } from '@llaab/skills';
import type { AppCtx, AppCtxJson } from '../../types/app.types.js';
import type { RunAgentBody } from './agent.schema.js';

export const run = {
  path: '/run' as const,
  handler: async (c: AppCtxJson<RunAgentBody>) => {
    const body = c.req.valid('json');
    try {
      const summary = await runAgentLoop({ nodeId: body.nodeId, force: body.force });
      return c.json(summary);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Agent loop failed' }, 500);
    }
  },
};

export const status = {
  path: '/status' as const,
  handler: async (c: AppCtx) => {
    try {
      const agentStatus = await getAgentStatus();
      return c.json(agentStatus);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Could not read agent status' }, 500);
    }
  },
};
