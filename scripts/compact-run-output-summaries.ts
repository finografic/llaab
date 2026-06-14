#!/usr/bin/env tsx

import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { RunNode } from '../packages/schemas/src/index.js';

import { readNode, VAULT_ROOT, writeNode } from '../packages/core/src/index.js';

const SUMMARY_STRING_LIMIT = 200;
const LARGE_RUN_TEXT_LIMIT = 1000;
const LARGE_TEXT_KEYS = new Set(['body', 'plainText', 'text', 'transcript']);

interface CliOptions {
  write: boolean;
}

interface CompactResult {
  value: unknown;
  changed: boolean;
}

function parseOptions(argv: string[]): CliOptions {
  return {
    write: argv.includes('--write'),
  };
}

function compactLargeRunText(value: string) {
  return {
    omitted: true,
    reason: 'large text stored in referenced node',
    chars: value.length,
    preview: value.slice(0, SUMMARY_STRING_LIMIT),
  };
}

function parseJsonString(value: string): unknown {
  let current: unknown = value;

  for (let i = 0; i < 5 && typeof current === 'string'; i += 1) {
    try {
      current = JSON.parse(current);
    } catch {
      return current;
    }
  }

  return current;
}

function compactRunValue(value: unknown, parentKey?: string): CompactResult {
  if (typeof value === 'string') {
    if (parentKey && LARGE_TEXT_KEYS.has(parentKey) && value.length > LARGE_RUN_TEXT_LIMIT) {
      return { value: compactLargeRunText(value), changed: true };
    }

    return { value, changed: false };
  }

  if (Array.isArray(value)) {
    let changed = false;
    const compacted = value.map((item) => {
      const result = compactRunValue(item);
      changed ||= result.changed;
      return result.value;
    });
    return { value: compacted, changed };
  }

  if (value === null || typeof value !== 'object') {
    return { value, changed: false };
  }

  let changed = false;
  const compacted = Object.fromEntries(
    Object.entries(value).map(([key, val]) => {
      const result = compactRunValue(val, key);
      changed ||= result.changed;
      return [key, result.value];
    }),
  );

  return { value: compacted, changed };
}

function compactSummary(value: string | undefined): { summary: string | undefined; changed: boolean } {
  if (!value) return { summary: value, changed: false };

  const parsed = parseJsonString(value);
  const compacted = compactRunValue(parsed);

  if (!compacted.changed) return { summary: value, changed: false };

  return {
    summary: JSON.stringify(compacted.value),
    changed: true,
  };
}

function compactRunNode(run: RunNode): { run: RunNode; changed: boolean; estimatedSavings: number } {
  const beforeSize = JSON.stringify({
    input_summary: run.input_summary,
    output_summary: run.output_summary,
    stages: run.stages,
  }).length;

  const inputSummary = compactSummary(run.input_summary);
  const outputSummary = compactSummary(run.output_summary);
  const stages = compactRunValue(run.stages);

  const nextRun: RunNode = {
    ...run,
    input_summary: inputSummary.summary,
    output_summary: outputSummary.summary,
    stages: stages.value as RunNode['stages'],
  };

  const changed = inputSummary.changed || outputSummary.changed || stages.changed;
  const afterSize = JSON.stringify({
    input_summary: nextRun.input_summary,
    output_summary: nextRun.output_summary,
    stages: nextRun.stages,
  }).length;

  return {
    run: nextRun,
    changed,
    estimatedSavings: Math.max(0, beforeSize - afterSize),
  };
}

async function listRunFiles(): Promise<string[]> {
  const runDir = join(VAULT_ROOT, 'runs');
  const entries = await readdir(runDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => join(runDir, entry.name))
    .sort();
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  return `${(value / 1024).toFixed(1)} KB`;
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const runFiles = await listRunFiles();
  let changedCount = 0;
  let estimatedSavings = 0;

  for (const filePath of runFiles) {
    const node = await readNode(filePath);
    if (node.type !== 'run') continue;

    const beforeStats = await stat(filePath);
    const result = compactRunNode(node);

    if (!result.changed) continue;

    changedCount += 1;
    estimatedSavings += result.estimatedSavings;

    if (options.write) {
      await writeNode(result.run);
      const afterText = await readFile(filePath, 'utf-8');
      console.log(
        `compacted ${result.run.id}: ${formatBytes(beforeStats.size)} -> ${formatBytes(Buffer.byteLength(afterText))}`,
      );
    } else {
      console.log(`would compact ${result.run.id}: ~${formatBytes(result.estimatedSavings)} saved`);
    }
  }

  const mode = options.write ? 'Compacted' : 'Would compact';
  console.log(`${mode} ${changedCount} run file(s), ~${formatBytes(estimatedSavings)} estimated savings.`);

  if (!options.write) {
    console.log('Run again with --write to update vault run files.');
  }
}

await main();
