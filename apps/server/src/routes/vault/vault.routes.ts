import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createNode, deleteNode, getNodeFilePath, listNodes, readNode, VAULT_ROOT } from '@llaab/core';
import { extractKnowledgeFromTranscript } from '@llaab/ingestion';
import type { AppCtx, AppCtxJson, AppCtxQuery } from '../../types/app.types.js';
import type { CreateNodeBody, ListNodesQuery } from './vault.schema.js';
import type { RunNode, TranscriptNode } from '@llaab/schemas';

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
      return c.json({ content });
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

export const transcriptIdeas = {
  path: '/transcripts/:id/ideas' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();
    const allNodes = await listNodes();
    const transcript = allNodes.find((n) => n.id === id && n.type === 'transcript') as
      | TranscriptNode
      | undefined;
    if (!transcript) return c.json({ error: 'Transcript not found' }, 404);
    const ideaIds: string[] = transcript.extracted_idea_ids ?? [];
    const ideas = allNodes
      .filter((n) => n.type === 'idea' && ideaIds.includes(n.id))
      .map((n) => ({ id: n.id, title: n.title }));
    return c.json({ ideas });
  },
};

export const extractTranscript = {
  path: '/transcripts/:id/extract' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();
    const nodes = await listNodes({ type: 'transcript' });
    const node = nodes.find((n) => n.id === id) as TranscriptNode | undefined;
    if (!node) return c.json({ error: 'Transcript not found' }, 404);
    if (!node.body) return c.json({ error: 'Transcript has no body' }, 400);

    const filePath = getNodeFilePath(node.type, node.id);
    try {
      const result = await extractKnowledgeFromTranscript(id, filePath, node.body);
      return c.json({ success: true, ...result });
    } catch (err) {
      return c.json({ success: false, error: err instanceof Error ? err.message : 'Extraction failed' }, 500);
    }
  },
};

export const discardTranscript = {
  path: '/transcripts/:id' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();

    // Read directly by path — avoids listNodes scan returning stale/incomplete results
    const transcriptPath = getNodeFilePath('transcript', id);
    let transcript: TranscriptNode;
    try {
      transcript = (await readNode(transcriptPath)) as TranscriptNode;
    } catch {
      return c.json({ error: 'Transcript not found' }, 404);
    }

    // Delete idea nodes
    for (const ideaId of transcript.extracted_idea_ids ?? []) {
      try {
        await deleteNode('idea', ideaId);
      } catch {
        /* best-effort */
      }
    }

    // Delete source node
    if (transcript.source_id) {
      try {
        await deleteNode('source', transcript.source_id);
      } catch {
        /* best-effort */
      }
    }

    // Delete associated run node (find by produced_node_ids containing this transcript)
    try {
      const runNodes = await listNodes({ type: 'run' });
      for (const n of runNodes) {
        if (n.type === 'run' && (n as RunNode).produced_node_ids?.includes(id)) {
          try {
            await deleteNode('run', n.id);
          } catch {
            /* best-effort */
          }
        }
      }
    } catch {
      /* best-effort */
    }

    await deleteNode('transcript', id);
    return c.json({ success: true });
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
