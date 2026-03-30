import type { NodeType } from '@llaab/schemas';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

const VAULT_ROOT = join(process.cwd(), 'vault', 'nodes');

const NODE_DIR_MAP: Record<NodeType, string> = {
  idea: 'ideas',
  decision: 'decisions',
  prompt: 'prompts',
  instruction: 'instructions',
  resource: 'resources',
};

export interface CreateNodeInput {
  type: NodeType;
  title: string;
  body?: string;
  tags?: string[];
}

export async function createNode(input: CreateNodeInput): Promise<{ id: string; path: string }> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const slug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

  const dir = join(VAULT_ROOT, NODE_DIR_MAP[input.type]);
  await mkdir(dir, { recursive: true });

  const filename = `${slug}--${id.slice(0, 8)}.md`;
  const filepath = join(dir, filename);

  const frontmatter = [
    '---',
    `id: ${id}`,
    `type: ${input.type}`,
    `title: "${input.title}"`,
    `createdAt: "${now}"`,
    `updatedAt: "${now}"`,
    `tags: [${(input.tags ?? []).join(', ')}]`,
    '---',
    '',
    input.body ?? '',
  ].join('\n');

  await writeFile(filepath, frontmatter, 'utf-8');

  return { id, path: filepath };
}
