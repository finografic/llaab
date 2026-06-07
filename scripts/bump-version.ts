#!/usr/bin/env bun

/**
 * Bumps every workspace package (packages/* and apps/*) to the same version number in lockstep,
 * then re-syncs pnpm-lock.yaml. LLAAB packages are not published independently, so there is no
 * value in tracking separate versions per package — usage: bun scripts/bump-version.ts <patch|minor|major>
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { $ } from 'bun';

type BumpType = 'patch' | 'minor' | 'major';

const ROOT = path.resolve(import.meta.dir, '..');

function parseBumpType(argv: string[]): BumpType {
  const [type] = argv;
  if (type === 'patch' || type === 'minor' || type === 'major') return type;
  throw new Error('Usage: bun scripts/bump-version.ts <patch|minor|major>');
}

function parseSemver(version: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) throw new Error(`Cannot parse version "${version}" as semver.`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemver(a: string, b: string): number {
  const [aMajor, aMinor, aPatch] = parseSemver(a);
  const [bMajor, bMinor, bPatch] = parseSemver(b);
  return bMajor - aMajor || bMinor - aMinor || bPatch - aPatch;
}

function bumpSemver(version: string, type: BumpType): string {
  const [major, minor, patch] = parseSemver(version);
  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

async function findWorkspacePackageFiles(): Promise<string[]> {
  const glob = new Bun.Glob('{packages,apps}/*/package.json');
  const files: string[] = [];
  for await (const file of glob.scan({ cwd: ROOT, absolute: true })) {
    files.push(file);
  }
  return files.sort();
}

async function main() {
  const bumpType = parseBumpType(Bun.argv.slice(2));
  const files = await findWorkspacePackageFiles();

  const versionsByFile = new Map<string, string>();
  for (const file of files) {
    const pkg = JSON.parse(await readFile(file, 'utf-8')) as { version?: unknown };
    if (typeof pkg.version === 'string') versionsByFile.set(file, pkg.version);
  }

  if (versionsByFile.size === 0) {
    throw new Error('No workspace package.json files with a "version" field were found.');
  }

  // Packages may have drifted out of lockstep — bump from whichever is currently highest.
  const baseline = [...versionsByFile.values()].sort(compareSemver)[0]!;
  const next = bumpSemver(baseline, bumpType);

  console.log(`Bumping all workspace packages: ${baseline} → ${next} (${bumpType})\n`);

  for (const file of files) {
    const current = versionsByFile.get(file);
    if (current === undefined) continue;

    const raw = await readFile(file, 'utf-8');
    const updated = raw.replace(/^(\s*"version":\s*")[^"]*(")/m, `$1${next}$2`);
    await writeFile(file, updated);
    console.log(`  ${path.relative(ROOT, file)}: ${current} → ${next}`);
  }

  console.log('\nSyncing pnpm-lock.yaml…');
  // --ignore-scripts: a lockfile-only sync needs no lifecycle scripts, and running them here has been
  // observed to trigger unrelated side effects (e.g. rewriting .vscode/launch.json's schema version).
  await $`pnpm install --lockfile-only --ignore-scripts`.cwd(ROOT).quiet();

  console.log('\nCommitting…');
  const toStage = [...files, path.join(ROOT, 'pnpm-lock.yaml')].map((file) => path.relative(ROOT, file));
  await $`git add -- ${toStage}`.cwd(ROOT).quiet();
  await $`git commit -m ${`chore: ${bumpType} version bump to ${next}`}`.cwd(ROOT).quiet();

  console.log(`\nDone — every workspace package is now at ${next}, committed.`);
}

await main();
