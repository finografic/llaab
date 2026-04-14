#!/usr/bin/env bun

import { readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';

const RECENT_THRESHOLD_HOURS = 24;
const VAULT_DIR = path.resolve(process.cwd(), 'vault');
const TARGET_DIRS = ['runs', 'sources', 'transcripts', '.tmp'] as const;

interface CliOptions {
  hours: number;
  yes: boolean;
}

function parseOptions(argv: string[]): CliOptions {
  let hours = RECENT_THRESHOLD_HOURS;
  let yes = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--yes' || arg === '-y') {
      yes = true;
      continue;
    }

    if (arg === '--hours') {
      const raw = argv[i + 1];
      if (!raw) {
        throw new Error('Missing value for --hours.');
      }
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --hours value "${raw}". Use a positive number.`);
      }
      hours = parsed;
      i += 1;
    }
  }

  return { hours, yes };
}

async function askForConfirmation(hours: number): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const input = await rl.question(`\nClean vault artifacts modified in the last ${hours}h? (y/N) `);
  rl.close();
  return /^y(es)?$/i.test(input.trim());
}

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

async function cleanRecentVaultActivity(hours: number): Promise<number> {
  const now = Date.now();
  const cutoffMs = hours * 60 * 60 * 1000;
  let removedCount = 0;

  for (const relativeDir of TARGET_DIRS) {
    const absoluteDir = path.join(VAULT_DIR, relativeDir);
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

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const isConfirmed = options.yes || (await askForConfirmation(options.hours));

  if (!isConfirmed) {
    console.log('\nCleaning aborted.');
    return;
  }

  const removedCount = await cleanRecentVaultActivity(options.hours);
  console.log(`\nRemoved ${removedCount} recent vault artifact file(s).`);
}

await main();
