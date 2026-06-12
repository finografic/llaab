import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { VAULT_ROOT } from '@llaab/core';

const SKIP = new Set(['.tmp', '.DS_Store', '.gitkeep']);

export interface VaultTreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: VaultTreeNode[];
}

export async function readVaultTree(dir: string, rel = ''): Promise<VaultTreeNode[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nodes: VaultTreeNode[] = [];

  for (const entry of entries) {
    if (SKIP.has(entry.name) || entry.name.startsWith('.')) continue;

    const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: entryRel,
        type: 'dir',
        children: await readVaultTree(path.join(dir, entry.name), entryRel),
      });
    } else {
      nodes.push({ name: entry.name, path: entryRel, type: 'file' });
    }
  }

  return nodes.sort((left, right) => {
    if (left.type !== right.type) return left.type === 'dir' ? -1 : 1;
    return left.name.localeCompare(right.name);
  });
}

export async function readVaultRootTree(): Promise<VaultTreeNode[]> {
  return readVaultTree(VAULT_ROOT);
}
