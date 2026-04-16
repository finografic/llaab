import { appendFile, mkdir, stat, writeFile } from 'fs/promises';
import { join } from 'path';
import { autoTag, createNode, VAULT_ROOT } from '@llaab/core';
import { formatIsoUtcSeconds } from '@llaab/schemas';

// ─── Config ───────────────────────────────────────────────────────────────────

const INBOX_FILE = join(VAULT_ROOT, 'INBOX.md');

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
