import { access, mkdir, writeFile } from 'fs/promises';
import { dirname } from 'node:path';
import { nodeSchemaByType, now, toNodeId } from '@llaab/schemas';
import type { LabNode, NodeType } from '@llaab/schemas';

import { getNodeFilePath, nodeToMarkdown } from './node-file.utils.js';

// ─── Create Node ──────────────────────────────────────────────────────────────

export interface CreateNodeInput {
  type: NodeType;
  title: string;
  body?: string;
  tags?: string[];
  extra?: Record<string, unknown>;
}

export async function createNode(
  input: CreateNodeInput,
): Promise<{ id: string; path: string; node: LabNode }> {
  const nodeId = toNodeId(input.title);
  const timestamp = now();

  const node = nodeSchemaByType[input.type].parse({
    id: nodeId,
    type: input.type,
    title: input.title,
    tags: input.tags ?? [],
    related: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    status: 'seed',
    body: input.body ?? '',
    ...(input.extra ?? {}),
  }) as LabNode;

  const filePath = getNodeFilePath(input.type, node.id);
  const dirPath = dirname(filePath);

  await mkdir(dirPath, { recursive: true });
  await ensureFileDoesNotExist(filePath);
  await writeFile(filePath, nodeToMarkdown(node), 'utf-8');

  return { id: node.id, path: filePath, node };
}

async function ensureFileDoesNotExist(filePath: string): Promise<void> {
  try {
    await access(filePath);
    throw new Error(`Node already exists at ${filePath}`);
  } catch (error) {
    const errorCode =
      typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : undefined;

    if (errorCode !== 'ENOENT') {
      throw error;
    }
  }
}
