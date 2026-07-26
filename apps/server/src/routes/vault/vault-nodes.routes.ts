import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import {
  cleanRecentVaultActivity,
  createNode,
  deleteNode,
  getNodeFilePath,
  listNodes,
  searchVaultNodes,
  updateNode,
  VAULT_ROOT,
} from '@llaab/core';
import type { AppCtx, AppCtxJson, AppCtxQuery } from '../../types/app.types.js';
import type {
  BatchUpdateVaultNodesBody,
  CleanRecentBody,
  CreateNodeBody,
  CreateResourceNodeBody,
  ListNodesQuery,
  SearchVaultQuery,
  UpdateVaultNodeBody,
} from './vault.schema.js';

import { renderReadmeToHtml } from '../../lib/readme-renderer.js';
import { renderVaultMarkdownSections } from '../../lib/vault-markdown-sections.js';
import { readVaultRootTree } from '../../lib/vault-tree.js';
import { scrubNodeReferences } from './scrub-node-references.js';

export const vaultTree = {
  path: '/tree' as const,
  handler: async (c: AppCtx) => {
    const tree = await readVaultRootTree();
    return c.json({ tree });
  },
};
export const cleanRecent = {
  path: '/clean-recent' as const,
  handler: async (c: AppCtxJson<CleanRecentBody>) => {
    const { hours } = c.req.valid('json');

    try {
      const removedCount = await cleanRecentVaultActivity(hours);
      return c.json({ success: true, removedCount });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Vault clean failed.';
      return c.json({ success: false, error: message }, 500);
    }
  },
};

export const file = {
  path: '/file' as const,
  handler: async (c: AppCtx) => {
    const filePath = c.req.query('path');
    if (!filePath) return c.json({ error: '`path` query parameter is required.' }, 400);

    const resolved = resolve(VAULT_ROOT, filePath);
    if (!resolved.startsWith(VAULT_ROOT + sep) && resolved !== VAULT_ROOT) {
      return c.json({ error: 'Invalid path.' }, 403);
    }

    try {
      const content = await readFile(resolved, 'utf-8');
      const extension = extname(resolved).toLowerCase();
      const renderMode = c.req.query('render');
      const isMarkdown = extension === '.md' || extension === '.markdown';
      const html = renderMode === 'markdown' && isMarkdown ? await renderReadmeToHtml(content) : null;
      const sections =
        renderMode === 'sections' && isMarkdown ? await renderVaultMarkdownSections(content) : [];
      return c.json({ content, html, sections });
    } catch {
      return c.json({ error: 'File not found.' }, 404);
    }
  },
};

export const listVaultNodes = {
  path: '/nodes' as const,
  handler: async (c: AppCtxQuery<ListNodesQuery>) => {
    const query = c.req.valid('query');
    const nodes = await listNodes(query);
    return c.json({ nodes });
  },
};

export const searchVault = {
  path: '/search' as const,
  handler: async (c: AppCtxQuery<SearchVaultQuery>) => {
    const query = c.req.valid('query');
    const results = await searchVaultNodes(query);
    return c.json({ results });
  },
};

export const createVaultNode = {
  path: '/nodes' as const,
  handler: async (c: AppCtxJson<CreateNodeBody>) => {
    const body = c.req.valid('json');
    try {
      const {
        id,
        path: createdPath,
        node,
      } = await createNode({
        type: body.type,
        title: body.title,
        body: body.body,
        tags: body.tags,
      });
      return c.json({ id, path: createdPath, type: node.type }, 201);
    } catch (err) {
      if (err instanceof Error && err.message.includes('already exists')) {
        return c.json({ error: 'A node with that title already exists.' }, 409);
      }
      return c.json({ error: 'Failed to create node.' }, 500);
    }
  },
};

export const createVaultResourceNode = {
  path: '/nodes/resource' as const,
  handler: async (c: AppCtxJson<CreateResourceNodeBody>) => {
    const body = c.req.valid('json');
    try {
      const {
        id,
        path: createdPath,
        node,
      } = await createNode({
        type: 'resource',
        title: body.title,
        body: body.body,
        tags: body.tags,
        extra: {
          related: body.related ?? [],
          url: body.url,
          resource_type: body.resource_type ?? 'reference',
          description: body.description,
        },
      });
      return c.json({ id, path: createdPath, type: node.type }, 201);
    } catch (err) {
      if (err instanceof Error && err.message.includes('already exists')) {
        return c.json({ error: 'A node with that title already exists.' }, 409);
      }
      return c.json({ error: 'Failed to create resource node.' }, 500);
    }
  },
};

export const nodeDetail = {
  path: '/nodes/:id' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();
    const nodes = await listNodes();
    const node = nodes.find((n) => n.id === id);
    if (!node) return c.json({ error: 'Node not found' }, 404);
    return c.json({ node });
  },
};

export const updateVaultNode = {
  path: '/nodes/:id' as const,
  handler: async (c: AppCtxJson<UpdateVaultNodeBody>) => {
    const { id } = c.req.param() as { id: string };
    const body = c.req.valid('json');
    const nodes = await listNodes();
    const node = nodes.find((n) => n.id === id);
    if (!node) return c.json({ error: 'Node not found' }, 404);

    try {
      const result = await updateNode(getNodeFilePath(node.type, node.id), (current) => ({
        ...current,
        tags: body.tags ?? current.tags,
        status: body.status ?? current.status,
        updated_at: new Date().toISOString(),
      }));
      return c.json({ node: result.node });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update node.';
      return c.json({ error: message }, 500);
    }
  },
};

export const batchUpdateVaultNodes = {
  path: '/nodes/batch' as const,
  handler: async (c: AppCtxJson<BatchUpdateVaultNodesBody>) => {
    const body = c.req.valid('json');
    const nodes = await listNodes();
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const updated = [];
    const missing: string[] = [];

    for (const id of body.ids) {
      const node = byId.get(id);
      if (!node) {
        missing.push(id);
        continue;
      }

      try {
        const result = await updateNode(getNodeFilePath(node.type, node.id), (current) => ({
          ...current,
          tags: body.tags ?? current.tags,
          status: body.status ?? current.status,
          updated_at: new Date().toISOString(),
        }));
        updated.push(result.node);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update node.';
        return c.json({ error: message, id }, 500);
      }
    }

    return c.json({ nodes: updated, missing });
  },
};

export const deleteVaultNode = {
  path: '/nodes/:id' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param() as { id: string };
    const nodes = await listNodes();
    const node = nodes.find((entry) => entry.id === id);
    if (!node) return c.json({ error: 'Node not found' }, 404);

    // Transcripts/sources/runs have dedicated discard/delete flows with richer cleanup.
    if (node.type !== 'idea' && node.type !== 'resource') {
      return c.json(
        {
          error: `Delete via this endpoint supports idea/resource nodes only (got ${node.type}).`,
        },
        400,
      );
    }

    try {
      const scrubbed = await scrubNodeReferences(node, nodes);
      await deleteNode(node.type, node.id);
      return c.json({
        success: true,
        deleted: { id: node.id, type: node.type, title: node.title },
        scrubbedReferences: scrubbed,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete node.';
      return c.json({ error: message }, 500);
    }
  },
};

export const nodeRaw = {
  path: '/nodes/:id/raw' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();
    const nodes = await listNodes();
    const node = nodes.find((n) => n.id === id);
    if (!node) return c.json({ error: 'Node not found' }, 404);

    const filePath = getNodeFilePath(node.type, node.id);
    if (!filePath.startsWith(VAULT_ROOT)) return c.json({ error: 'Forbidden' }, 403);

    const content = await readFile(filePath, 'utf-8');
    return c.text(content);
  },
};
