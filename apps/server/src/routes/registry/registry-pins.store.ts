import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { PinnedPackage } from '@llaab/schemas';

const DEFAULT_PINS_FILE = join(homedir(), '.llaab', 'pinned-packages.json');
const LEGACY_PINS_FILE = join(homedir(), '.llaab', 'pinned-libraries.json');
const PINS_FILE = process.env.LLAAB_PACKAGE_PINS_PATH ?? process.env.LLAAB_PINS_PATH ?? DEFAULT_PINS_FILE;

export async function readPins(): Promise<PinnedPackage[]> {
  const file = await readablePinsFile();

  try {
    const raw = await readFile(file, 'utf-8');
    return JSON.parse(raw) as PinnedPackage[];
  } catch {
    return [];
  }
}

export async function writePins(pins: PinnedPackage[]): Promise<void> {
  await mkdir(dirname(PINS_FILE), { recursive: true });
  await writeFile(PINS_FILE, JSON.stringify(pins, null, 2), 'utf-8');
}

async function readablePinsFile(): Promise<string> {
  if (await fileExists(PINS_FILE)) return PINS_FILE;
  if (PINS_FILE !== LEGACY_PINS_FILE && (await fileExists(LEGACY_PINS_FILE))) return LEGACY_PINS_FILE;
  return PINS_FILE;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
