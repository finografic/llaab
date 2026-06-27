import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { PinnedLibrary } from '@llaab/schemas';

const PINS_FILE = process.env.LLAAB_PINS_PATH ?? join(homedir(), '.llaab', 'pinned-libraries.json');

export async function readPins(): Promise<PinnedLibrary[]> {
  try {
    const raw = await readFile(PINS_FILE, 'utf-8');
    return JSON.parse(raw) as PinnedLibrary[];
  } catch {
    return [];
  }
}

export async function writePins(pins: PinnedLibrary[]): Promise<void> {
  await mkdir(dirname(PINS_FILE), { recursive: true });
  await writeFile(PINS_FILE, JSON.stringify(pins, null, 2), 'utf-8');
}
