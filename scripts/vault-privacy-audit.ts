#!/usr/bin/env bun
/**
 * Vault-privacy-audit.ts
 *
 * Scans vault nodes, lab/ directory, and config files for potentially
 * sensitive content before making the LLAAB repo public.
 *
 * Designed to be called by the /vault-privacy-audit Claude Code command,
 * which drives the interactive review session.
 *
 * Can also be run standalone for a dry-run report:
 * bun scripts/vault-privacy-audit.ts --report
 *
 * Approved files are remembered in scripts/vault-audit-approved.json.
 * A file approved in a previous run is silently skipped UNLESS it has
 * been modified since approval (git mtime check).
 */

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FlagCategory = 'secrets' | 'personal-data' | 'employer-references' | 'draft-notes' | 'lab-content';

interface FlaggedItem {
  filePath: string;
  category: FlagCategory;
  reason: string;
  lineNumber: number;
  lineContent: string;
  contextBefore: string[];
  contextAfter: string[];
}

interface ApprovedEntry {
  path: string;
  approvedAt: string; // ISO date string
  note: string;
}

interface ApprovedList {
  approved: ApprovedEntry[];
}

interface AuditResult {
  scannedFiles: number;
  flaggedItems: FlaggedItem[];
  skippedApproved: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Configuration — patterns that trigger flags
// ---------------------------------------------------------------------------

const SECRET_PATTERNS: RegExp[] = [
  /sk-[a-zA-Z0-9]{20,}/,
  /Bearer\s+[a-zA-Z0-9\-_]{20,}/,
  /API_KEY\s*[:=]\s*\S+/i,
  /SECRET\s*[:=]\s*\S+/i,
  /TOKEN\s*[:=]\s*[a-zA-Z0-9\-_]{16,}/i,
  /password\s*[:=]\s*\S+/i,
  /ghp_[a-zA-Z0-9]{36}/,
  /anthropic[_-]?key\s*[:=]\s*\S+/i,
];

const PERSONAL_DATA_PATTERNS: RegExp[] = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  /\+?61\s?\d{3}\s?\d{3}\s?\d{3}/,
  /\+?1[-.\s]?\(?\d{3}\)?\s?\d{3}[-.\s]\d{4}/,
];

const EMPLOYER_PATTERNS: RegExp[] = [
  /\bSage\b(?!\s+(Business|Cloud|Accounting|SBS|Design System|50|200|300|Intacct))/,
  /internal\s+(channel|repo|tool|system|dashboard|doc|wiki)/i,
  /\b(JIRA|Confluence|Slack)\s+#[A-Z]+-\d+/i,
];

const DRAFT_STATUS_PATTERN = /^status:\s*(draft|inbox|wip)\s*$/m;

const VAULT_SCAN_DIRS = ['vault', 'lab', 'configs'];
const SCAN_EXTENSIONS = new Set(['.md', '.ts', '.json', '.yaml', '.yml', '.env']);
const SKIP_PATHS = new Set([
  'node_modules',
  '.git',
  'styled-system',
  'dist',
  '.turbo',
  'vault-audit-skipped.log',
  'vault-audit-approved.json',
]);

const APPROVED_LIST_PATH = 'scripts/vault-audit-approved.json';

// ---------------------------------------------------------------------------
// Approved list — load, save, check
// ---------------------------------------------------------------------------

async function loadApprovedList(): Promise<ApprovedList> {
  if (!existsSync(APPROVED_LIST_PATH)) {
    return { approved: [] };
  }
  try {
    const raw = await readFile(APPROVED_LIST_PATH, 'utf-8');
    return JSON.parse(raw) as ApprovedList;
  } catch {
    return { approved: [] };
  }
}

/**
 * Returns the ISO date of the file's last git commit, or null if untracked.
 * Uses git log so it reflects committed changes, not filesystem mtime.
 */
async function gitLastCommitDate(filePath: string): Promise<string | null> {
  const proc = Bun.spawn(['git', 'log', '-1', '--format=%aI', filePath], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  await proc.exited;
  const out = await new Response(proc.stdout).text();
  const date = out.trim();
  return date.length > 0 ? date : null;
}

/**
 * Returns true if the file has been modified (new commits) since it was approved.
 * Untracked files (no git history) are always considered changed.
 */
async function hasChangedSinceApproval(filePath: string, approvedAt: string): Promise<boolean> {
  const lastCommit = await gitLastCommitDate(filePath);
  if (!lastCommit) return true; // untracked = treat as changed
  return new Date(lastCommit) > new Date(approvedAt);
}

// ---------------------------------------------------------------------------
// Git-ignored check — skip files that can never reach the public repo
// ---------------------------------------------------------------------------

async function isGitIgnored(filePath: string): Promise<boolean> {
  const proc = Bun.spawn(['git', 'check-ignore', '-q', filePath], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  await proc.exited;
  return proc.exitCode === 0;
}

// ---------------------------------------------------------------------------
// Directory walker
// ---------------------------------------------------------------------------

async function walkDir(dir: string): Promise<string[]> {
  const files: string[] = [];
  if (!existsSync(dir)) return files;

  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_PATHS.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkDir(fullPath)));
    } else if (entry.isFile() && SCAN_EXTENSIONS.has(extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// Per-line pattern scanner
// ---------------------------------------------------------------------------

function checkLine(
  line: string,
  lineIndex: number,
  lines: string[],
  filePath: string,
  flags: FlaggedItem[],
): void {
  const addFlag = (category: FlagCategory, reason: string) => {
    flags.push({
      filePath,
      category,
      reason,
      lineNumber: lineIndex + 1,
      lineContent: line,
      contextBefore: lines.slice(Math.max(0, lineIndex - 3), lineIndex),
      contextAfter: lines.slice(lineIndex + 1, lineIndex + 4),
    });
  };

  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(line)) {
      addFlag('secrets', `Possible secret/credential: matched pattern ${pattern.source.slice(0, 40)}`);
      return;
    }
  }
  for (const pattern of PERSONAL_DATA_PATTERNS) {
    if (pattern.test(line)) {
      addFlag('personal-data', `Possible personal data: matched pattern ${pattern.source.slice(0, 40)}`);
      return;
    }
  }
  for (const pattern of EMPLOYER_PATTERNS) {
    if (pattern.test(line)) {
      addFlag('employer-references', `Possible employer/colleague reference: "${line.trim().slice(0, 80)}"`);
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Per-file auditor
// ---------------------------------------------------------------------------

async function auditFile(filePath: string): Promise<FlaggedItem[]> {
  const flags: FlaggedItem[] = [];

  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return flags;
  }

  const lines = content.split('\n');

  if (filePath.startsWith('vault/') && DRAFT_STATUS_PATTERN.test(content)) {
    flags.push({
      filePath,
      category: 'draft-notes',
      reason: 'Node has draft/inbox/wip status — review body for raw private thought before publishing',
      lineNumber: 0,
      lineContent: '(frontmatter status field)',
      contextBefore: [],
      contextAfter: lines.slice(0, 5),
    });
  }

  if (filePath.startsWith('lab/') && !filePath.endsWith('.gitkeep')) {
    flags.push({
      filePath,
      category: 'lab-content',
      reason: 'File is in lab/ — review whether this is suitable for public viewing',
      lineNumber: 0,
      lineContent: '(entire file)',
      contextBefore: [],
      contextAfter: lines.slice(0, 8),
    });
  }

  if (!filePath.startsWith('lab/')) {
    for (let i = 0; i < lines.length; i++) {
      checkLine(lines[i], i, lines, filePath, flags);
    }
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Main audit runner
// ---------------------------------------------------------------------------

async function runAudit(): Promise<AuditResult & { approvedList: ApprovedList }> {
  const result: AuditResult & { approvedList: ApprovedList } = {
    scannedFiles: 0,
    flaggedItems: [],
    skippedApproved: 0,
    errors: [],
    approvedList: await loadApprovedList(),
  };

  const approvedMap = new Map(result.approvedList.approved.map((e) => [e.path, e]));

  const allFiles: string[] = [];
  for (const dir of VAULT_SCAN_DIRS) {
    allFiles.push(...(await walkDir(dir)));
  }
  for (const rootFile of [
    '.env',
    '.env.local',
    '.env.example',
    'configs/lab.config.ts',
    'configs/llm.config.ts',
  ]) {
    if (existsSync(rootFile)) allFiles.push(rootFile);
  }

  result.scannedFiles = allFiles.length;

  for (const filePath of allFiles) {
    // Skip gitignored files — they can never be public
    if (await isGitIgnored(filePath)) continue;

    // Skip previously approved files unless modified since approval
    const approvedEntry = approvedMap.get(filePath);
    if (approvedEntry) {
      const changed = await hasChangedSinceApproval(filePath, approvedEntry.approvedAt);
      if (!changed) {
        result.skippedApproved++;
        continue;
      }
      // Changed since approval — re-flag it (will note this in the item reason)
    }

    const flags = await auditFile(filePath);

    // If a file was previously approved but has changed, annotate its flags
    if (approvedEntry && flags.length > 0) {
      for (const flag of flags) {
        flag.reason = `[CHANGED SINCE APPROVAL] ${flag.reason}`;
      }
    }

    result.flaggedItems.push(...flags);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const isReport = process.argv.includes('--report');
const result = await runAudit();

if (isReport) {
  console.log(`\n🔍 Vault Privacy Audit — Dry Run`);
  console.log(`   Scanned:          ${result.scannedFiles} files`);
  console.log(`   Skipped (approved): ${result.skippedApproved} files`);
  console.log(`   Flagged:          ${result.flaggedItems.length} items\n`);

  const byCategory = result.flaggedItems.reduce(
    (acc, item) => {
      acc[item.category] = (acc[item.category] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  for (const [category, count] of Object.entries(byCategory)) {
    console.log(`   ${category}: ${count}`);
  }

  console.log(`\n--- Flagged Items ---\n`);
  for (const item of result.flaggedItems) {
    console.log(`📁 ${item.filePath}:${item.lineNumber}`);
    console.log(`   Category: ${item.category}`);
    console.log(`   Reason:   ${item.reason}`);
    if (item.lineContent !== '(entire file)' && item.lineContent !== '(frontmatter status field)') {
      console.log(`   Line:     ${item.lineContent.trim().slice(0, 120)}`);
    }
    console.log();
  }

  if (result.flaggedItems.length === 0) {
    console.log('✅ No flags raised. Looks clean for public release.\n');
  }
} else {
  // Structured output for Claude Code — includes the approvedList so the
  // command can write back to it after the session
  console.log(JSON.stringify(result, null, 2));
}
