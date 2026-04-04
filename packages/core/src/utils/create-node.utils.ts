import type { LabNode, NodeType } from '@llaab/schemas';
import { formatNodeFilename, nodeSchemaByType, now, toNodeId } from '@llaab/schemas';
import { access, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

// ─── Config ───────────────────────────────────────────────────────────────────

const VAULT_ROOT = join(process.cwd(), 'vault');

const NODE_DIR_MAP: Record<NodeType, string> = {
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

// ─── Frontmatter Serialization ────────────────────────────────────────────────

const FRONTMATTER_KEY_ORDER = ['id', 'type', 'title', 'status', 'tags', 'related', 'createdAt', 'updatedAt'];

function serializeFrontmatterValue(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
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

function nodeToMarkdown(node: LabNode): string {
  const { body, ...frontmatter } = node;
  const orderedKeys = [
    ...FRONTMATTER_KEY_ORDER.filter((key) => key in frontmatter),
    ...Object.keys(frontmatter)
      .filter((key) => !FRONTMATTER_KEY_ORDER.includes(key))
      .sort(),
  ];

  const frontmatterLines = orderedKeys.map(
    (key) => `${key}: ${serializeFrontmatterValue(frontmatter[key as keyof typeof frontmatter])}`,
  );

  return ['---', ...frontmatterLines, '---', '', body].join('\n').trimEnd() + '\n';
}

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

  const dirPath = join(VAULT_ROOT, NODE_DIR_MAP[input.type]);
  const filePath = join(dirPath, formatNodeFilename(input.type, node.id));

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
