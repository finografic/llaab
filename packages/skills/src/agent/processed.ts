import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { VAULT_ROOT } from '@llaab/core';

const INDEX_DIR = join(VAULT_ROOT, '.agent-loop');
const INDEX_PATH = join(INDEX_DIR, 'index.json');

type ProcessedIndex = Record<string, string[]>;

export interface AgentStatusMeta {
  lastRunAt?: string;
  totalProcessed: number;
  totalSkipped: number;
  totalFailed: number;
  indexPath: string;
}

interface IndexFile {
  nodes: ProcessedIndex;
  meta: Omit<AgentStatusMeta, 'indexPath'>;
}

let cache: ProcessedIndex | null = null;

async function load(): Promise<ProcessedIndex> {
  if (cache) return cache;
  try {
    const text = await readFile(INDEX_PATH, 'utf-8');
    const parsed = JSON.parse(text) as Partial<IndexFile>;
    cache = parsed.nodes ?? {};
  } catch {
    cache = {};
  }
  return cache;
}

async function readMeta(): Promise<Omit<AgentStatusMeta, 'indexPath'>> {
  try {
    const text = await readFile(INDEX_PATH, 'utf-8');
    const parsed = JSON.parse(text) as Partial<IndexFile>;
    return parsed.meta ?? { totalProcessed: 0, totalSkipped: 0, totalFailed: 0 };
  } catch {
    return { totalProcessed: 0, totalSkipped: 0, totalFailed: 0 };
  }
}

async function persist(
  index: ProcessedIndex,
  meta?: Partial<Omit<AgentStatusMeta, 'indexPath'>>,
): Promise<void> {
  await mkdir(INDEX_DIR, { recursive: true });
  const existingMeta = await readMeta();
  await writeFile(
    INDEX_PATH,
    JSON.stringify({ nodes: index, meta: { ...existingMeta, ...meta } }, null, 2),
    'utf-8',
  );
}

export async function hasProcessed(nodeId: string, skill: string): Promise<boolean> {
  const index = await load();
  return index[nodeId]?.includes(skill) ?? false;
}

export async function markProcessed(nodeId: string, skill: string): Promise<void> {
  const index = await load();
  if (!index[nodeId]) index[nodeId] = [];
  if (!index[nodeId].includes(skill)) {
    index[nodeId].push(skill);
    await persist(index);
  }
}

export async function clearIndex(): Promise<void> {
  cache = {};
  await persist({});
}

export async function writeRunMeta(meta: Partial<Omit<AgentStatusMeta, 'indexPath'>>): Promise<void> {
  const index = await load();
  await persist(index, meta);
}

export async function getAgentStatus(): Promise<AgentStatusMeta> {
  const meta = await readMeta();
  return { ...meta, indexPath: INDEX_PATH };
}
