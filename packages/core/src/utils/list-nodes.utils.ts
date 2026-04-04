import type { LabNode, NodeStatus, NodeType } from '@llaab/schemas';
import { readdir } from 'fs/promises';
import { join } from 'path';

import { readNode } from './read-node.utils.js';

// ─── Config ───────────────────────────────────────────────────────────────────

const VAULT_ROOT = join(process.cwd(), 'vault');

// ─── Vault Scanner ────────────────────────────────────────────────────────────

async function scanMarkdownFiles(dirPath: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const nestedPaths = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => scanMarkdownFiles(join(dirPath, entry.name))),
  );

  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => join(dirPath, entry.name));

  return [...files, ...nestedPaths.flat()];
}

// ─── List Nodes ───────────────────────────────────────────────────────────────

export interface ListNodesOptions {
  type?: NodeType;
  status?: NodeStatus;
  tags?: string[];
  search?: string;
  limit?: number;
}

export async function listNodes(options: ListNodesOptions = {}): Promise<LabNode[]> {
  const files = await scanMarkdownFiles(VAULT_ROOT);
  const nodes = await Promise.all(
    files.map(async (filePath) => {
      try {
        return await readNode(filePath);
      } catch {
        return null;
      }
    }),
  );

  return nodes
    .filter((node): node is LabNode => node !== null)
    .filter((node) => (options.type ? node.type === options.type : true))
    .filter((node) => (options.status ? node.status === options.status : true))
    .filter((node) => {
      if (!options.tags?.length) return true;
      return options.tags.some((tag) => node.tags.includes(tag));
    })
    .filter((node) => {
      if (!options.search) return true;
      const searchValue = options.search.toLowerCase();
      return (
        node.title.toLowerCase().includes(searchValue) ||
        node.tags.some((tag) => tag.toLowerCase().includes(searchValue)) ||
        node.body.toLowerCase().includes(searchValue)
      );
    })
    .slice(0, options.limit ?? Number.POSITIVE_INFINITY);
}
