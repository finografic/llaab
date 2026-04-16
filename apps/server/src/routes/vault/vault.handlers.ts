import { readFile } from 'node:fs/promises';
import { createNode, getNodeFilePath, listNodes, VAULT_ROOT } from '@llaab/core';
import { StatusCodes } from 'http-status-codes';
import type { CreateNodeBody, ListNodesQuery } from './vault.routes.js';
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

export async function handleCreateNode(c: Context) {
  const body = c.req.valid('json' as never) as CreateNodeBody;

  try {
    const { id, path, node } = await createNode({
      type: body.type,
      title: body.title,
      body: body.body,
      tags: body.tags,
    });
    return c.json({ id, path, type: node.type }, StatusCodes.CREATED);
  } catch (err) {
    if (err instanceof Error && err.message.includes('already exists')) {
      return c.json({ error: 'A node with that title already exists.' }, StatusCodes.CONFLICT);
    }
    return c.json({ error: 'Failed to create node.' }, StatusCodes.INTERNAL_SERVER_ERROR);
  }
}
