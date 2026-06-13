import { readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

import { VAULT_ROOT } from './node-file.utils.js';

const TARGET_DIRS = [
  'runs',
  'sources',
  'transcripts',
  'nodes/ideas',
  'nodes/canonical-ideas',
  '.tmp',
] as const;

async function listFilesRecursively(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursively(entryPath)));
      continue;
    }
    files.push(entryPath);
  }

  return files;
}

function assertValidHours(hours: number): void {
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error(`Invalid hours value "${hours}". Use a positive number.`);
  }
}

async function countRecentFilesInRelativeDir(relativeDir: string, hours: number): Promise<number> {
  assertValidHours(hours);

  const now = Date.now();
  const cutoffMs = hours * 60 * 60 * 1000;
  const absoluteDir = path.join(VAULT_ROOT, relativeDir);
  let count = 0;

  try {
    const files = await listFilesRecursively(absoluteDir);
    for (const filePath of files) {
      const fileStats = await stat(filePath);
      const ageMs = now - fileStats.mtimeMs;
      if (ageMs <= cutoffMs) {
        count += 1;
      }
    }
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      typeof error.code === 'string' &&
      error.code === 'ENOENT'
    ) {
      return 0;
    }
    throw error;
  }

  return count;
}

/** Count run files modified within the last `hours` hours. */
export async function countRecentVaultRuns(hours: number): Promise<number> {
  return countRecentFilesInRelativeDir('runs', hours);
}

/** Remove vault artifact files modified within the last `hours` hours. */
export async function cleanRecentVaultActivity(hours: number): Promise<number> {
  assertValidHours(hours);

  const now = Date.now();
  const cutoffMs = hours * 60 * 60 * 1000;
  let removedCount = 0;

  for (const relativeDir of TARGET_DIRS) {
    const absoluteDir = path.join(VAULT_ROOT, relativeDir);
    try {
      const files = await listFilesRecursively(absoluteDir);
      for (const filePath of files) {
        const fileStats = await stat(filePath);
        const ageMs = now - fileStats.mtimeMs;
        if (ageMs <= cutoffMs) {
          await rm(filePath, { force: true });
          removedCount += 1;
        }
      }
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        typeof error.code === 'string' &&
        error.code === 'ENOENT'
      ) {
        continue;
      }
      throw error;
    }
  }

  return removedCount;
}
