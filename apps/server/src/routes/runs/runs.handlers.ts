import { listNodes } from '@llaab/core';
import { StatusCodes } from 'http-status-codes';
import type { RunNode } from '@llaab/schemas';
import type { Context } from 'hono';

export async function handleListRuns(c: Context) {
  const all = await listNodes({ type: 'run' });
  const runs = (all as RunNode[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return c.json({ runs });
}

export async function handleGetRun(c: Context) {
  const { id } = c.req.param();
  const all = await listNodes({ type: 'run' });
  const run = (all as RunNode[]).find((r) => r.id === id);

  if (!run) {
    return c.json({ error: 'Run not found' }, StatusCodes.NOT_FOUND);
  }

  return c.json({ run });
}
