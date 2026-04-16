import { readFile } from 'node:fs/promises';
import { getNodeFilePath, listNodes, VAULT_ROOT } from '@llaab/core';
import { StatusCodes } from 'http-status-codes';
import type { ListNodesQuery } from './vault.routes.js';
import type { Context } from 'hono';

export async function handleListNodes(c: Context) {
  const query = c.req.valid('query' as never) as ListNodesQuery;
  const nodes = await listNodes(query);
  return c.json({ nodes });
}

export async function handleGetNode(c: Context) {
  const { id } = c.req.param();
  const nodes = await listNodes();
  const node = nodes.find((n) => n.id === id);

  if (!node) {
    return c.json({ error: 'Node not found' }, StatusCodes.NOT_FOUND);
  }

  return c.json({ node });
}

export async function handleGetNodeRaw(c: Context) {
  const { id } = c.req.param();
  const nodes = await listNodes();
  const node = nodes.find((n) => n.id === id);

  if (!node) {
    return c.json({ error: 'Node not found' }, StatusCodes.NOT_FOUND);
  }

  const filePath = getNodeFilePath(node.type, node.id);

  // Ensure the resolved path is within the vault root (path traversal guard)
  if (!filePath.startsWith(VAULT_ROOT)) {
    return c.json({ error: 'Forbidden' }, StatusCodes.FORBIDDEN);
  }

  const content = await readFile(filePath, 'utf-8');
  return c.text(content);
}
