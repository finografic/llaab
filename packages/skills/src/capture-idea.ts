import { createNode } from '@llaab/core';
import { appendFile, mkdir, stat, writeFile } from 'fs/promises';
import { join } from 'path';

const VAULT_ROOT = process.env.LLAAB_VAULT || './vault';
const INBOX_FILE = join(VAULT_ROOT, 'INBOX.md');

function suggestTags(title: string, body: string): string[] {
  const text = `${title} ${body}`.toLowerCase();
  const suggestions: Array<[string, RegExp]> = [
    ['automation', /\bautomation\b|\bagent\b/],
    ['ingestion', /\bingest\b|\btranscript\b|\byoutube\b/],
    ['schema', /\bschema\b|\bzod\b/],
    ['llm', /\bllm\b|\bollama\b|\banthropic\b|\bprompt\b/],
  ];

  return suggestions.filter(([, pattern]) => pattern.test(text)).map(([tag]) => tag);
}

async function appendToInbox(title: string, id: string, tags: string[]): Promise<void> {
  const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
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

export async function captureIdea(title: string, body?: string, tags?: string[]): Promise<void> {
  const inferredTags = suggestTags(title, body ?? '');
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
