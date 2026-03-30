import type { AnyNode, NodeType } from '@llaab/schemas';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

import { parseFrontmatter } from './parse-frontmatter.utils.js';

const VAULT_ROOT = join(process.cwd(), 'vault', 'nodes');

const NODE_DIR_MAP: Record<NodeType, string> = {
  idea: 'ideas',
  decision: 'decisions',
  prompt: 'prompts',
  instruction: 'instructions',
  resource: 'resources',
};

export async function listNodes(type?: NodeType): Promise<AnyNode[]> {
  const types: NodeType[] = type ? [type] : (Object.keys(NODE_DIR_MAP) as NodeType[]);
  const results: AnyNode[] = [];

  for (const t of types) {
    const dir = join(VAULT_ROOT, NODE_DIR_MAP[t]);
    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      continue;
    }

    for (const file of files.filter((f) => f.endsWith('.md'))) {
      const content = await readFile(join(dir, file), 'utf-8');
      try {
        const { frontmatter, body } = parseFrontmatter(content);
        results.push({ ...frontmatter, body } as unknown as AnyNode);
      } catch {
        // skip malformed files
      }
    }
  }

  return results;
}
