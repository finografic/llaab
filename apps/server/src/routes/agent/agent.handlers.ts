import { getAgentStatus, runAgentLoop } from '@llaab/skills';
import { StatusCodes } from 'http-status-codes';
import type { RunAgentBody } from './agent.routes.js';
import type { Context } from 'hono';

export async function handleAgentRun(c: Context) {
  const body = c.req.valid('json' as never) as RunAgentBody;

  try {
    const summary = await runAgentLoop({ nodeId: body.nodeId, force: body.force });
    return c.json(summary);
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : 'Agent loop failed' },
      StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
}

export async function handleAgentStatus(c: Context) {
  try {
    const status = await getAgentStatus();
    return c.json(status);
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : 'Could not read agent status' },
      StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
}
