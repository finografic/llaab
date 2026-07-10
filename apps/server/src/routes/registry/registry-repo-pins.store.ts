import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { PinnedRepository } from '@llaab/schemas';

const REPO_PINS_FILE =
  process.env.LLAAB_REPO_PINS_PATH ?? join(homedir(), '.llaab', 'pinned-repositories.json');

export async function readRepoPins(): Promise<PinnedRepository[]> {
  try {
    const raw = await readFile(REPO_PINS_FILE, 'utf-8');
    return JSON.parse(raw) as PinnedRepository[];
  } catch {
    return [];
  }
}

export async function writeRepoPins(pins: PinnedRepository[]): Promise<void> {
  await mkdir(dirname(REPO_PINS_FILE), { recursive: true });
  await writeFile(REPO_PINS_FILE, JSON.stringify(pins, null, 2), 'utf-8');
}
