/**
 * Audit and optionally fix `package.json` script key separators (dots → colons).
 *
 * Modes:
 * - default → audit only (no files written)
 * - `--fix` → rewrite dotted keys and references on disk
 *
 * Example:
 * - `tsx scripts/audit-script-separators.ts` — audit
 * - `tsx scripts/audit-script-separators.ts --fix` — apply fixes
 */

import { styleText } from 'node:util';

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, relative } from 'path';

/* -------------------------------------------------------------------------------------------------
 * types
 * ------------------------------------------------------------------------------------------------- */

interface PackageScript {
  filePath: string;
  key: string;
  command: string;
}

interface FileMatch {
  filePath: string;
  count: number;
}

/* -------------------------------------------------------------------------------------------------
 * config
 * ------------------------------------------------------------------------------------------------- */

const WORKSPACE_ROOT = process.cwd();

const args = process.argv.slice(2);
const SHOULD_FIX = args.includes('--fix');

/* -------------------------------------------------------------------------------------------------
 * utils
 * ------------------------------------------------------------------------------------------------- */

function colorize() {
  return {
    title: (s: string) => styleText(['yellow', 'bold'], s),
    section: (s: string) => styleText(['gray', 'bold'], s),
    filePath: (s: string) => styleText(['cyan', 'bold', 'dim'], s),
    ok: (s: string) => styleText('greenBright', s),
    warn: (s: string) => styleText('yellow', s),
    muted: (s: string) => styleText('gray', s),
    key: (s: string) => styleText('cyan', s),
    count: (s: string) => styleText('yellowBright', s),
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isDottedScriptKey(key: string): boolean {
  return key.includes('.');
}

function toColonKey(key: string): string {
  return key.replace(/\./g, ':');
}

function detectScriptKeyCollisions(scripts: Record<string, string>): Array<{ from: string; to: string }> {
  const collisions: Array<{ from: string; to: string }> = [];
  const seen = new Set(Object.keys(scripts));

  for (const key of Object.keys(scripts)) {
    if (!key.includes('.')) continue;

    const transformed = key.replace(/\./g, ':');

    if (seen.has(transformed) && transformed !== key) {
      collisions.push({ from: key, to: transformed });
    }
  }

  return collisions;
}

/* -------------------------------------------------------------------------------------------------
 * filesystem discovery
 * ------------------------------------------------------------------------------------------------- */

async function findAllPackageJsonFiles(dir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string) {
    const entries = await readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(current, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        await walk(fullPath);
      } else if (entry.name === 'package.json') {
        results.push(relative(WORKSPACE_ROOT, fullPath));
      }
    }
  }

  await walk(dir);
  return results.sort();
}

async function findWorkflowFiles(): Promise<string[]> {
  const workflowDir = join(WORKSPACE_ROOT, '.github', 'workflows');

  try {
    const entries = await readdir(workflowDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile())
      .map((e) => relative(WORKSPACE_ROOT, join(workflowDir, e.name)))
      .sort();
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------------------------------
 * loading
 * ------------------------------------------------------------------------------------------------- */

async function loadPackageScripts(packageJsonPath: string): Promise<PackageScript[]> {
  const absolutePath = join(WORKSPACE_ROOT, packageJsonPath);

  let raw: string;
  try {
    raw = await readFile(absolutePath, 'utf-8');
  } catch {
    return [];
  }

  let parsed: { scripts?: Record<string, string> };
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn(`Failed to parse ${packageJsonPath}`);
    return [];
  }

  const scripts = parsed.scripts ?? {};

  return Object.entries(scripts).map(([key, command]) => ({
    filePath: packageJsonPath,
    key,
    command,
  }));
}

/* -------------------------------------------------------------------------------------------------
 * search
 * ------------------------------------------------------------------------------------------------- */

async function findScriptReferences(scriptKey: string, targetPaths: readonly string[]): Promise<FileMatch[]> {
  const pattern = new RegExp(`(?<![\\w.-])${escapeRegExp(scriptKey)}(?![\\w.-])`, 'g');

  const matches: FileMatch[] = [];

  for (const targetPath of targetPaths) {
    const absolutePath = join(WORKSPACE_ROOT, targetPath);

    let content: string;
    try {
      content = await readFile(absolutePath, 'utf-8');
    } catch {
      continue;
    }

    const count = [...content.matchAll(pattern)].length;

    if (count > 0) {
      matches.push({ filePath: targetPath, count });
    }
  }

  return matches;
}

/* -------------------------------------------------------------------------------------------------
 * fixers
 * ------------------------------------------------------------------------------------------------- */

async function fixPackageJsonScripts(filePath: string): Promise<number> {
  const absolutePath = join(WORKSPACE_ROOT, filePath);

  let raw: string;
  try {
    raw = await readFile(absolutePath, 'utf-8');
  } catch {
    throw new Error(`Failed to read ${filePath}`);
  }

  let parsed: { scripts?: Record<string, string> };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Failed to parse ${filePath}`);
  }

  if (!parsed.scripts) return 0;

  const collisions = detectScriptKeyCollisions(parsed.scripts);

  if (collisions.length > 0) {
    console.warn(`\nCollision detected in ${filePath}:`);

    for (const c of collisions) {
      console.warn(`- ${c.from} → ${c.to} (already exists)`);
    }

    console.warn('Skipping file to avoid overwriting.\n');
    return 0;
  }

  const original = parsed.scripts;
  const updated: Record<string, string> = {};

  let changes = 0;

  for (const [key, value] of Object.entries(original)) {
    if (isDottedScriptKey(key)) {
      const newKey = toColonKey(key);
      updated[newKey] = value;
      changes++;
    } else {
      updated[key] = value;
    }
  }

  if (changes === 0) return 0;

  parsed.scripts = updated;

  await writeFile(absolutePath, JSON.stringify(parsed, null, 2) + '\n');

  return changes;
}

async function fixReferences(filePath: string, dottedToColonMap: Map<string, string>): Promise<number> {
  const absolutePath = join(WORKSPACE_ROOT, filePath);

  let content: string;
  try {
    content = await readFile(absolutePath, 'utf-8');
  } catch {
    return 0;
  }

  let updated = content;
  let totalChanges = 0;

  for (const [from, to] of dottedToColonMap.entries()) {
    const pattern = new RegExp(`(?<![\\w.-])${escapeRegExp(from)}(?![\\w.-])`, 'g');

    const matches = [...updated.matchAll(pattern)].length;
    if (matches > 0) {
      updated = updated.replace(pattern, to);
      totalChanges += matches;
    }
  }

  if (totalChanges > 0) {
    await writeFile(absolutePath, updated);
  }

  return totalChanges;
}

/* -------------------------------------------------------------------------------------------------
 * main
 * ------------------------------------------------------------------------------------------------- */

async function main(): Promise<void> {
  const c = colorize();

  const packageJsonFiles = await findAllPackageJsonFiles(WORKSPACE_ROOT);
  const workflowFiles = await findWorkflowFiles();
  const auditTargets = [...packageJsonFiles, ...workflowFiles];

  const scripts = (await Promise.all(packageJsonFiles.map((p) => loadPackageScripts(p)))).flat();

  const dottedScripts = scripts.filter((s) => isDottedScriptKey(s.key));

  console.log('');
  console.log(c.title('Script separator audit'));
  console.log('');

  if (dottedScripts.length === 0) {
    console.log(c.ok('No dotted script keys found.'));
    return;
  }

  console.log(c.section('Audit results:'));
  console.log('');

  let totalReferences = 0;

  for (const script of dottedScripts) {
    const matches = await findScriptReferences(script.key, auditTargets);
    const scriptTotal = matches.reduce((acc, m) => acc + m.count, 0);
    totalReferences += scriptTotal;

    console.log(`${styleText('bold', 'Script:')} ${c.key(script.key)}`);
    console.log(`Defined in: ${c.filePath(script.filePath)}`);

    if (matches.length === 0) {
      console.log(c.muted('References: none found'));
    } else {
      console.log('References:');
      for (const match of matches) {
        console.log(`- ${match.filePath}: ${c.count(String(match.count))}`);
      }
    }

    console.log('');
  }

  console.log(c.section('Summary:'));
  console.log('');
  console.log(`- Dotted scripts: ${dottedScripts.length}`);
  console.log(`- Total references: ${totalReferences}`);
  console.log('');

  if (!SHOULD_FIX) {
    console.log(c.ok('No files were written (audit only)'));
    console.log('');
    return;
  }

  console.log(c.ok('Applying fixes..'));
  console.log('');

  const dottedToColon = new Map<string, string>();
  for (const s of dottedScripts) {
    dottedToColon.set(s.key, toColonKey(s.key));
  }

  let scriptFixes = 0;
  for (const file of packageJsonFiles) {
    scriptFixes += await fixPackageJsonScripts(file);
  }

  let referenceFixes = 0;
  for (const file of auditTargets) {
    referenceFixes += await fixReferences(file, dottedToColon);
  }

  console.log('');
  console.log(c.section('Fix Summary:'));
  console.log('');
  console.log(`- Script keys updated: ${scriptFixes}`);
  console.log(`- References updated: ${referenceFixes}`);
  console.log('');
  console.log(c.ok('Fixes applied successfully'));
  console.log('');
}

await main();
