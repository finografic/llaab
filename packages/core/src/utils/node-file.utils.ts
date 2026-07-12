import { join } from 'node:path';
import { formatNodeFilename } from '@llaab/schemas';
import type { LabNode, NodeType } from '@llaab/schemas';

import { markdownWithFrontmatter } from './markdown-frontmatter.utils.js';
import { VAULT_ROOT } from './vault-root.js';
export { VAULT_ROOT };

export const NODE_DIR_MAP: Record<NodeType, string> = {
  'canonical-idea': 'nodes/canonical-ideas',
  'decision': 'nodes/decisions',
  'idea': 'nodes/ideas',
  'instruction': 'nodes/instructions',
  'prompt': 'nodes/prompts',
  'resource': 'nodes/resources',
  'run': 'runs',
  'skill': 'nodes/skills',
  'source': 'sources',
  'transcript': 'transcripts',
  'wiki-draft': 'nodes/wiki-drafts',
};

const FRONTMATTER_KEY_ORDER = [
  'id',
  'type',
  'title',
  'status',
  'tags',
  'related',
  'created_at',
  'updated_at',
];

export function getNodeFilePath(type: NodeType, id: string): string {
  return join(VAULT_ROOT, NODE_DIR_MAP[type], formatNodeFilename(type, id));
}

export function getNodeDirectoryPath(type: NodeType): string {
  return join(VAULT_ROOT, NODE_DIR_MAP[type]);
}

export function nodeToMarkdown(node: LabNode): string {
  const { body, ...frontmatter } = node;
  return markdownWithFrontmatter(frontmatter, body, FRONTMATTER_KEY_ORDER);
}
