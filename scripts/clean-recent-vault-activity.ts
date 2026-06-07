#!/usr/bin/env bun

import readline from 'node:readline/promises';
import { cleanRecentVaultActivity } from '@llaab/core';

const RECENT_THRESHOLD_HOURS = 24;

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
