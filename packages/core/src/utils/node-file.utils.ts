import { join } from 'node:path';
import { formatNodeFilename } from '@llaab/schemas';
import type { LabNode, NodeType } from '@llaab/schemas';

import { VAULT_ROOT } from './vault-root.js';
export { VAULT_ROOT };

export const NODE_DIR_MAP: Record<NodeType, string> = {
  decision: 'nodes/decisions',
  idea: 'nodes/ideas',
  instruction: 'nodes/instructions',
  prompt: 'nodes/prompts',
  resource: 'nodes/resources',
  run: 'runs',
  skill: 'nodes/skills',
  source: 'sources',
  transcript: 'transcripts',
};

const FRONTMATTER_KEY_ORDER = ['id', 'type', 'title', 'status', 'tags', 'related', 'createdAt', 'updatedAt'];

function serializeFrontmatterValue(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.some((item) => typeof item === 'object' && item !== null)) {
      return JSON.stringify(value);
    }
    return `\n${value.map((item) => `  - ${String(item)}`).join('\n')}`;
  }

  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  return String(value);
}

export function getNodeFilePath(type: NodeType, id: string): string {
  return join(VAULT_ROOT, NODE_DIR_MAP[type], formatNodeFilename(type, id));
}

export function nodeToMarkdown(node: LabNode): string {
  const { body, ...frontmatter } = node;
  const definedFrontmatter = Object.fromEntries(
    Object.entries(frontmatter).filter(([, value]) => value !== undefined),
  ) as Record<string, unknown>;
  const orderedKeys = [
    ...FRONTMATTER_KEY_ORDER.filter((key) => key in definedFrontmatter),
    ...Object.keys(definedFrontmatter)
      .filter((key) => !FRONTMATTER_KEY_ORDER.includes(key))
      .sort(),
  ];

  const frontmatterLines = orderedKeys.map(
    (key) => `${key}: ${serializeFrontmatterValue(definedFrontmatter[key])}`,
  );

  return ['---', ...frontmatterLines, '---', '', body].join('\n').trimEnd() + '\n';
}
