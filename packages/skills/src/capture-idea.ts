import { appendFile, mkdir, stat, writeFile } from 'fs/promises';
import { join } from 'path';
import { createNode, VAULT_ROOT } from '@llaab/core';
import { formatIsoUtcSeconds } from '@llaab/schemas';

// ─── Config ───────────────────────────────────────────────────────────────────

const INBOX_FILE = join(VAULT_ROOT, 'INBOX.md');
const AUTO_TAG_PATTERNS: Array<[string, RegExp]> = [
  ['llm', /\b(llm|gpt|claude|ollama|anthropic|model|prompt)\b/i],
  ['automation', /\b(agent|autonomous|workflow|automation|pipeline)\b/i],
  ['ingestion', /\b(ingest|ingestion|transcript|youtube)\b/i],
  ['schema', /\b(schema|zod|validation|type)\b/i],
  ['tooling', /\b(cli|terminal|command|script|bash)\b/i],
  ['integration', /\b(mcp|cursor|tauri|astro|integration)\b/i],
  ['ui', /\b(ui|frontend|component|layout|design)\b/i],
  ['graph', /\b(graph|link|relationship|connection)\b/i],
  ['execution', /\b(skill|execute|run)\b/i],
  ['meta', /\b(llaab|lab|self-referential|meta)\b/i],
];

// ─── Inbox ────────────────────────────────────────────────────────────────────

async function appendToInbox(title: string, id: string, tags: string[]): Promise<void> {
  const timestamp = formatIsoUtcSeconds(new Date()).replace('T', ' ').replace(/Z$/, '');
  const tagSuffix = tags.length ? ` [${tags.join(', ')}]` : '';
  const line = `- [ ] ${timestamp} | ${title}${tagSuffix} -> [[${id}]]\n`;

  await mkdir(VAULT_ROOT, { recursive: true });

  try {
    await stat(INBOX_FILE);
  } catch {
    await writeFile(INBOX_FILE, '# LLAAB Inbox\n\nCaptured ideas waiting to be structured.\n\n', 'utf-8');
  }

  await appendFile(INBOX_FILE, line, 'utf-8');
}

// ─── Auto-tagging ─────────────────────────────────────────────────────────────

function autoTag(title: string, body: string): string[] {
  const text = `${title} ${body}`;
  return AUTO_TAG_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([tag]) => tag);
}

// ─── Capture Idea ─────────────────────────────────────────────────────────────

export async function captureIdea(title: string, body?: string, tags?: string[]): Promise<void> {
  const inferredTags = autoTag(title, body ?? '');
  const mergedTags = Array.from(new Set([...(tags ?? []), ...inferredTags]));

  const { id, path } = await createNode({
    type: 'idea',
    title,
    body,
    tags: mergedTags,
    extra: {
      origin: 'manual',
    },
  });

  await appendToInbox(title, id, mergedTags);

  console.log(`Idea captured: ${id}`);
  console.log(`  -> ${path}`);
}
