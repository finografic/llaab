#!/usr/bin/env tsx
/**
 * Reorganize .github/instructions/ from numbered-flat → subfolder layout.
 *
 * Self-migration (no SOURCE arg): NN-name.instructions.md → subfolder/name.instructions.md
 * project/NN-name.instructions.md → project/name.instructions.md Writes general.instructions.md + README.md
 * from embedded strings.
 *
 * Copy from golden source (SOURCE arg or INSTRUCTIONS_SOURCE env): Copies subfolder tree from SOURCE → TARGET
 * (skips project/, embedded files).
 *
 * Both modes: merges .claude/handoff.md → .ai/handoff.md when present. Patches CLAUDE.md, AGENTS.md, and
 * .github/copilot-instructions.md. All steps are idempotent — safe to re-run on already-migrated repos.
 *
 * Usage: tsx refactor-agent-instructions.ts [TARGET] [SOURCE] INSTRUCTIONS_SOURCE=~~/golden tsx
 * refactor-agent-instructions.ts [TARGET] INSTRUCTIONS_FALLBACK=~~/other-repo tsx
 * refactor-agent-instructions.ts [TARGET]
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

// ── CLI args / paths ──────────────────────────────────────────────────────────

const resolve = (p: string) => path.resolve(p);

const target = resolve(process.argv[2] ?? process.cwd());
const rawSource = process.env['INSTRUCTIONS_SOURCE'] ?? process.argv[3] ?? '';
const source = rawSource ? resolve(rawSource) : target;

if (!fs.existsSync(target)) {
  console.error(`ERROR: target not found: ${target}`);
  process.exit(1);
}
if (!fs.existsSync(source)) {
  console.error(`ERROR: source not found: ${source}`);
  process.exit(1);
}

const instDst = path.join(target, '.github/instructions');
const instSrc = path.join(source, '.github/instructions');

// Fallback source for copying missing canonical instruction files.
const FALLBACK_SOURCE = process.env['INSTRUCTIONS_FALLBACK'] ?? path.join(os.homedir(), 'LLAAB');

console.log('refactor-agent-instructions');
console.log(`  target   : ${target}`);
console.log(`  source   : ${source}`);
console.log(`  fallback : ${FALLBACK_SOURCE}`);
console.log();

// ── logging ───────────────────────────────────────────────────────────────────

const ok = (msg: string) => console.log(`  ✓ ${msg}`);
const skip = (msg: string) => console.log(`  - ${msg}`);
const fail = (msg: string) => console.log(`  ✗ ${msg}`);
const info = (msg: string) => console.log(`  · ${msg}`);
const formatUnknownError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// ── subfolder map ─────────────────────────────────────────────────────────────

const FOLDER_MAP: Record<string, string> = {
  'typescript-patterns': 'code',
  'linting-code-style': 'code',
  'modern-typescript-patterns': 'code',
  'provider-context-patterns': 'code',
  'picocolors-cli-styling': 'code',
  'file-naming': 'naming',
  'variable-naming': 'naming',
  'documentation': 'documentation',
  'readme-standards': 'documentation',
  'agent-facing-markdown': 'documentation',
  'feature-design-specs': 'documentation',
  'todo-done-docs': 'documentation',
  'git-policy': 'git',
};

// Canonical subfolder files. Any file present in target subfolders but NOT here → "Other".
const CANONICAL: Record<string, string[]> = {
  code: [
    'typescript-patterns',
    'linting-code-style',
    'modern-typescript-patterns',
    'provider-context-patterns',
    'picocolors-cli-styling',
  ],
  naming: ['file-naming', 'variable-naming'],
  documentation: [
    'documentation',
    'readme-standards',
    'agent-facing-markdown',
    'feature-design-specs',
    'todo-done-docs',
  ],
  git: ['git-policy'],
};

// ── layout helpers ────────────────────────────────────────────────────────────

function layoutPresent(): boolean {
  return (
    fs.existsSync(path.join(instDst, 'code')) &&
    fs.existsSync(path.join(instDst, 'naming')) &&
    fs.existsSync(path.join(instDst, 'documentation')) &&
    fs.existsSync(path.join(instDst, 'git'))
  );
}

function numberedFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{2}-/.test(f) && f.endsWith('.instructions.md'))
    .map((f) => path.join(dir, f));
}

function stripNumPrefix(filename: string): string {
  return filename.replace(/^\d{2}-/, '');
}

// ── self-migration ────────────────────────────────────────────────────────────

function migrateInPlace(): void {
  console.log('instructions/  self-migration');
  let moved = 0,
    skipped = 0,
    errors = 0;

  for (const src of numberedFiles(instDst)) {
    const filename = path.basename(src);
    const name = filename.replace(/^\d{2}-/, '').replace(/\.instructions\.md$/, '');

    if (name === 'general') {
      try {
        fs.rmSync(src);
        ok(`${filename} → removed (replaced by embedded general.instructions.md)`);
        moved++;
      } catch (e) {
        fail(`${filename} → remove failed: ${formatUnknownError(e)}`);
        errors++;
      }
      continue;
    }

    const folder = FOLDER_MAP[name];
    if (!folder) {
      skip(`${filename} → no mapping (left in place)`);
      skipped++;
      continue;
    }

    const dstDir = path.join(instDst, folder);
    const dst = path.join(dstDir, `${name}.instructions.md`);
    try {
      fs.mkdirSync(dstDir, { recursive: true });
      fs.renameSync(src, dst);
      ok(`${filename} → ${folder}/${name}.instructions.md`);
      moved++;
    } catch (e) {
      fail(`${filename} → failed: ${formatUnknownError(e)}`);
      errors++;
    }
  }

  // Strip numeric prefixes from project/ files
  const projectDir = path.join(instDst, 'project');
  for (const src of numberedFiles(projectDir)) {
    const filename = path.basename(src);
    const newname = stripNumPrefix(filename);
    const dst = path.join(projectDir, newname);
    try {
      fs.renameSync(src, dst);
      ok(`project/${filename} → project/${newname}`);
      moved++;
    } catch (e) {
      fail(`project/${filename} → failed: ${formatUnknownError(e)}`);
      errors++;
    }
  }

  console.log(`  → ${moved} moved, ${skipped} skipped, ${errors} errors`);
}

// ── copy from golden source ───────────────────────────────────────────────────

function copyFromSource(): void {
  console.log('instructions/  copy from source');
  let copied = 0,
    errors = 0;

  const walk = (dir: string): string[] => {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).flatMap((entry) => {
      const full = path.join(dir, entry);
      return fs.statSync(full).isDirectory() ? walk(full) : [full];
    });
  };

  const SKIP_NAMES = new Set(['general.instructions.md', 'README.md']);

  for (const srcFile of walk(instSrc)) {
    const rel = path.relative(instSrc, srcFile);
    if (rel.startsWith('project/') || SKIP_NAMES.has(path.basename(srcFile))) continue;

    const dst = path.join(instDst, rel);
    try {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(srcFile, dst);
      ok(rel);
      copied++;
    } catch (e) {
      fail(`${rel} → ${formatUnknownError(e)}`);
      errors++;
    }
  }

  console.log(`  → ${copied} copied, ${errors} errors`);
}

// ── embedded files ────────────────────────────────────────────────────────────

const GENERAL_INSTRUCTIONS = `\
# General Development Rules

These rules guide code suggestions and refactors. Apply them consistently across the project.

## Code Quality

- Use TypeScript with \`strict\` mode.
- Prefer type-safe code; avoid \`any\`.
- Use camelCase for variables; PascalCase for types/components.
- Add JSDoc for complex functions and public APIs.
- Prefer explicit return types.

## Control Flow

- Prefer guard clauses over nested \`if/else\`.
- Use single-level ternaries only; avoid nested ternaries.

## Error Handling

- Handle errors explicitly; avoid swallowing.
- Use clear, typed error shapes where feasible.

## Performance & Security

- Minimize dependencies; enable tree-shaking.
- Avoid leaking sensitive data; validate public API inputs.

## Markdown Conventions

- Use plain headings (\`##\`, \`###\`) without extra bold.
- Add blank lines around code blocks.
- Wrap filenames/paths/methods/variables in backticks for inline code.
`;

const INSTRUCTIONS_README = `\
# .github/instructions — AI Instruction Files

Rules and conventions loaded automatically by Claude Code, Cursor, GitHub Copilot, and other
AI coding tools. Files use the \`.instructions.md\` suffix. \`README.md\` (this file) is not loaded
as a rule file — it exists purely for navigation and to define how this folder is maintained.

---

## Folder Structure

| Folder             | Contents                                                                   |
| ------------------ | -------------------------------------------------------------------------- |
| (root)             | \`general.instructions.md\` — baseline rules that apply everywhere           |
| \`code/\`            | TypeScript patterns, ESLint/oxlint style, code conventions, CLI styling    |
| \`naming/\`          | File naming, variable naming, identifier conventions                       |
| \`documentation/\`   | Documentation standards, README rules, agent-facing markdown, design specs |
| \`git/\`             | Commit conventions, branch policy, release process                         |
| \`project/\`         | Project-specific constraints — not part of the shared convention set       |

---

## How to Add a New Instruction File

1. Pick the folder using the table above.
2. Name it descriptively — no numeric prefix: \`my-topic.instructions.md\`.
3. If the rule applies only to this repository (not a general convention), put it in \`project/\`.
4. Add an entry to the relevant section in \`/AGENTS.md\` so agents know it exists.

---

## Rules for This Directory

- **No numeric prefixes.** Names must be descriptive, not ordered. Order implies priority; these files have none.
- **One concern per file.** If a file spans two unrelated topics, split it.
- **General rules** that don't belong in any subfolder go in \`general.instructions.md\` at the root.
- **\`project/\`** is strictly for repository-specific constraints. Everything else is reusable convention.
- **Don't add an index here.** \`/AGENTS.md\` is the cross-agent entry point; this README explains structure.
`;

function writeEmbeddedFiles(): void {
  console.log('instructions/  write embedded files');
  fs.mkdirSync(instDst, { recursive: true });
  try {
    fs.writeFileSync(path.join(instDst, 'general.instructions.md'), GENERAL_INSTRUCTIONS);
    ok('general.instructions.md');
  } catch (e) {
    fail(`general.instructions.md → ${formatUnknownError(e)}`);
  }
  try {
    fs.writeFileSync(path.join(instDst, 'README.md'), INSTRUCTIONS_README);
    ok('README.md');
  } catch (e) {
    fail(`README.md → ${formatUnknownError(e)}`);
  }
}

// ── handoff migration ─────────────────────────────────────────────────────────

const DEFAULT_HANDOFF_PREAMBLE = `\
# Project — Handoff

> **How to maintain this file**
> Update after sessions that change architecture, add/remove features, resolve open questions, or shift priorities — not every session.
> — Update only the sections that changed. Keep the total under 150 lines.
> — Write in present tense. No code snippets — describe what exists, not how it works.
> — \`.claude/memory.md\` = session work log. \`.ai/handoff.md\` = project state snapshot. Never duplicate between the two.

`;

function mergeHandoff(): void {
  console.log('handoff/  .claude/handoff.md → .ai/handoff.md');
  const claudeHandoff = path.join(target, '.claude/handoff.md');
  if (!fs.existsSync(claudeHandoff)) {
    skip('.claude/handoff.md not found — nothing to merge');
    return;
  }

  // Already done if .ai/handoff.md exists and .claude/handoff.md is gone
  // (we check .claude/handoff.md existence above — if it's here, we still need to merge)

  let preamble = DEFAULT_HANDOFF_PREAMBLE;
  const sourceHandoff = path.join(source, '.ai/handoff.md');
  if (fs.existsSync(sourceHandoff)) {
    const lines = fs.readFileSync(sourceHandoff, 'utf8').split('\n');
    if (lines.length >= 10) {
      preamble = lines.slice(0, 10).join('\n') + '\n';
    } else {
      info(`source .ai/handoff.md is short (${lines.length} lines) — using builtin preamble`);
    }
  } else {
    info('no source .ai/handoff.md — using builtin preamble');
  }

  const aiDir = path.join(target, '.ai');
  fs.mkdirSync(aiDir, { recursive: true });

  const outPath = path.join(aiDir, 'handoff.md');
  if (fs.existsSync(outPath)) {
    const bak = `${outPath}.pre-refactor-${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}Z`;
    fs.copyFileSync(outPath, bak);
    info(`existing .ai/handoff.md backed up → ${path.basename(bak)}`);
  }

  try {
    const body = fs.readFileSync(claudeHandoff, 'utf8');
    fs.writeFileSync(outPath, preamble + body);
    ok('.claude/handoff.md merged into .ai/handoff.md');
    fs.rmSync(claudeHandoff);
    ok('.claude/handoff.md removed');
  } catch (e) {
    fail(`handoff merge failed: ${formatUnknownError(e)}`);
  }
}

// ── section helpers ───────────────────────────────────────────────────────────

/** Find [startLine, endLine) of a ## section matching predicate. */
function findSection(lines: string[], match: (h: string) => boolean): [number, number] | null {
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## ') && match(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      end = i;
      break;
    }
  }
  return [start, end];
}

function hasSection(lines: string[], match: (h: string) => boolean): boolean {
  return findSection(lines, match) !== null;
}

/** True if a ## section's body still contains old-style numbered instruction paths. */
function sectionHasOldPaths(lines: string[], match: (h: string) => boolean): boolean {
  const range = findSection(lines, match);
  if (!range) return false;
  return lines.slice(range[0], range[1]).some((l) => /instructions\/\d{2}-/.test(l));
}

/** Replace an existing section (heading + body). Returns false if not found. */
function replaceSection(lines: string[], match: (h: string) => boolean, newLines: string[]): boolean {
  const range = findSection(lines, match);
  if (!range) return false;
  lines.splice(range[0], range[1] - range[0], ...newLines);
  return true;
}

/** Insert newLines before a matching section. Appends to end if not found. */
function insertBeforeSection(lines: string[], match: (h: string) => boolean, newLines: string[]): void {
  const range = findSection(lines, match);
  lines.splice(range ? range[0] : lines.length, 0, ...newLines);
}

/** Insert newLines after the end of a matching section. Appends to end if not found. */
function insertAfterSection(lines: string[], match: (h: string) => boolean, newLines: string[]): void {
  const range = findSection(lines, match);
  lines.splice(range ? range[1] : lines.length, 0, ...newLines);
}

/** Insert newLines before the first ## section. */
function insertBeforeFirstSection(lines: string[], newLines: string[]): void {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      lines.splice(i, 0, ...newLines);
      return;
    }
  }
  lines.push(...newLines);
}

// ── canonical file management ─────────────────────────────────────────────────

interface ExtraFile {
  folder: string;
  name: string;
}

/**
 * Ensure all canonical instruction files exist in target; copy missing ones from fallback. Returns any
 * non-canonical files found in the subfolders.
 */
function ensureCanonicalFiles(targetInstDir: string): ExtraFile[] {
  const extra: ExtraFile[] = [];
  const fallbackInst = path.join(FALLBACK_SOURCE, '.github/instructions');

  for (const [folder, names] of Object.entries(CANONICAL)) {
    const folderPath = path.join(targetInstDir, folder);

    if (fs.existsSync(folderPath)) {
      for (const f of fs.readdirSync(folderPath)) {
        if (!f.endsWith('.instructions.md')) continue;
        const name = f.replace(/\.instructions\.md$/, '');
        if (!names.includes(name)) extra.push({ folder, name });
      }
    }

    for (const name of names) {
      const dst = path.join(folderPath, `${name}.instructions.md`);
      if (!fs.existsSync(dst)) {
        const src = path.join(fallbackInst, folder, `${name}.instructions.md`);
        if (fs.existsSync(src)) {
          fs.mkdirSync(folderPath, { recursive: true });
          fs.copyFileSync(src, dst);
          ok(`copied missing: ${folder}/${name}.instructions.md (from fallback)`);
        } else {
          fail(`missing canonical file: ${folder}/${name}.instructions.md (not in fallback either)`);
        }
      }
    }
  }
  return extra;
}

// ── section content builders ──────────────────────────────────────────────────

function buildRulesGlobalLines(extra: ExtraFile[]): string[] {
  const lines = [
    '## Rules — Global',
    '',
    'Rules are canonical in `.github/instructions/` — see `README.md` there for folder structure.',
    'Shared across Claude Code, Cursor, and GitHub Copilot.',
    '',
    '**General**',
    '',
    '- General baseline: `.github/instructions/general.instructions.md`',
    '',
    '**Code**',
    '',
    '- TypeScript patterns: `.github/instructions/code/typescript-patterns.instructions.md`',
    '- Modern TS patterns: `.github/instructions/code/modern-typescript-patterns.instructions.md`',
    '- ESLint & style: `.github/instructions/code/linting-code-style.instructions.md`',
    '- Provider/context patterns: `.github/instructions/code/provider-context-patterns.instructions.md`',
    '- Picocolors CLI styling: `.github/instructions/code/picocolors-cli-styling.instructions.md`',
    '',
    '**Naming**',
    '',
    '- File naming: `.github/instructions/naming/file-naming.instructions.md`',
    '- Variable naming: `.github/instructions/naming/variable-naming.instructions.md`',
    '',
    '**Documentation**',
    '',
    '- Documentation: `.github/instructions/documentation/documentation.instructions.md`',
    '- README standards: `.github/instructions/documentation/readme-standards.instructions.md`',
    '- Agent-facing markdown: `.github/instructions/documentation/agent-facing-markdown.instructions.md`',
    '- Feature design specs: `.github/instructions/documentation/feature-design-specs.instructions.md`',
    '- TODO/DONE docs: `.github/instructions/documentation/todo-done-docs.instructions.md`',
    '',
    '**Git**',
    '',
    '- Git policy: `.github/instructions/git/git-policy.instructions.md`',
  ];

  if (extra.length > 0) {
    lines.push('', '**Other**', '');
    for (const { folder, name } of extra) {
      const label = name
        .split('-')
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join(' ');
      lines.push(`- ${label}: \`.github/instructions/${folder}/${name}.instructions.md\``);
    }
  }

  lines.push('', '---', '');
  return lines;
}

const ROADMAP_SECTION_LINES = [
  '## Roadmap and Planning Docs',
  '',
  '**`docs/todo/ROADMAP.md` is the primary high-level plan for this project.**',
  '**`docs/todo/ROADMAP.md#next` is the near-term working list** — small tasks, fixes, and manual testing checklists.',
  '',
  '- Before proposing or generating new features, check the roadmap for existing items.',
  '- When conceiving a new feature or initiative, add it to the appropriate priority tier.',
  '- Detailed planning docs live alongside in `docs/todo/` as `TODO_*.md` (active) or `DONE_*.md` (complete).',
  '- **TODO/DONE doc conventions:** `.github/instructions/documentation/todo-done-docs.instructions.md`',
  '  — rules for naming, status headers, checkboxes, and graduating `TODO_` → `DONE_`.',
  '',
  '---',
  '',
];

const CLAUDE_CODE_SECTION_LINES = [
  '## Claude Code — Session Memory and Handoff',
  '',
  '> This section applies to Claude Code only. Other agents can ignore it.',
  '',
  '- **Session log:** `.claude/memory.md` (gitignored) — maintenance rules are in that file.',
  '- **Project state snapshot:** `.ai/handoff.md` (git-tracked) — maintenance rules are in that file.',
  '',
  '---',
  '',
];

// ── patch functions ───────────────────────────────────────────────────────────

function patchClaudeMd(): void {
  console.log('CLAUDE.md/');
  const claudePath = path.join(target, 'CLAUDE.md');
  if (!fs.existsSync(claudePath)) {
    skip('not found');
    return;
  }

  const current = fs.readFileSync(claudePath, 'utf8').trim();
  if (current === '@AGENTS.md') {
    skip('already @AGENTS.md');
    return;
  }

  fs.writeFileSync(claudePath, '@AGENTS.md\n');
  ok('reduced to @AGENTS.md');
}

function patchAgentsMd(extra: ExtraFile[]): void {
  console.log('AGENTS.md/');
  const agentsPath = path.join(target, 'AGENTS.md');
  if (!fs.existsSync(agentsPath)) {
    fail('not found');
    return;
  }

  let text = fs.readFileSync(agentsPath, 'utf8');

  // Normalise heading dash and strip old numeric prefixes from paths
  text = text.replace(/^## Rules - /gm, '## Rules — ');
  text = text.replace(/\.github\/instructions\/project\/\d{2}-/g, '.github/instructions/project/');
  text = text.replace(
    /\.github\/instructions\/\d{2}-git-policy\.instructions\.md/g,
    '.github/instructions/git/git-policy.instructions.md',
  );

  const lines = text.split('\n');

  if (!hasSection(lines, (h) => /roadmap/i.test(h))) {
    insertBeforeFirstSection(lines, ROADMAP_SECTION_LINES);
    ok('Roadmap section added');
  } else {
    skip('Roadmap section already present');
  }

  if (sectionHasOldPaths(lines, (h) => /rules.*global/i.test(h))) {
    replaceSection(lines, (h) => /rules.*global/i.test(h), buildRulesGlobalLines(extra));
    ok(`Rules — Global updated${extra.length ? ` (+${extra.length} extra in Other)` : ''}`);
  } else if (!hasSection(lines, (h) => /rules.*global/i.test(h))) {
    insertBeforeSection(
      lines,
      (h) => /markdown tables/i.test(h) || /learned/i.test(h),
      buildRulesGlobalLines(extra),
    );
    ok('Rules — Global section added');
  } else {
    skip('Rules — Global already up to date');
  }

  if (!hasSection(lines, (h) => /claude code/i.test(h))) {
    insertAfterSection(lines, (h) => /git policy/i.test(h), CLAUDE_CODE_SECTION_LINES);
    ok('Claude Code — Session Memory and Handoff section added');
  } else {
    skip('Claude Code section already present');
  }

  fs.writeFileSync(agentsPath, lines.join('\n'));
  ok('AGENTS.md written');
}

function patchCopilotInstructions(extra: ExtraFile[]): void {
  console.log('copilot-instructions.md/');
  const filePath = path.join(target, '.github/copilot-instructions.md');
  if (!fs.existsSync(filePath)) {
    skip('not found');
    return;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split('\n');

  // Match "Rules — Global", "Rules - Global", "Rule Files", etc.
  const isRulesSection = (h: string) => /rules?.*global/i.test(h) || /rule\s+files/i.test(h);

  if (!hasSection(lines, isRulesSection)) {
    skip('rules section not found');
    return;
  }
  if (!sectionHasOldPaths(lines, isRulesSection)) {
    skip('Rules — Global already up to date');
    return;
  }

  replaceSection(lines, isRulesSection, buildRulesGlobalLines(extra));
  ok(`Rules — Global updated${extra.length ? ` (+${extra.length} extra in Other)` : ''}`);

  fs.writeFileSync(filePath, lines.join('\n'));
  ok('copilot-instructions.md written');
}

// ── main ──────────────────────────────────────────────────────────────────────

console.log('instructions/');
if (!fs.existsSync(instSrc)) {
  fail(`source dir not found: ${instSrc}`);
} else {
  if (source === target) {
    // Self-migration: gate on numbered files, not dir presence (dirs may exist from prior partial runs).
    const pending = numberedFiles(instDst);
    if (pending.length === 0) {
      skip('no numbered files to migrate');
    } else {
      migrateInPlace();
    }
  } else {
    if (layoutPresent()) {
      skip('already migrated (code/, naming/, documentation/, git/ exist)');
    } else {
      copyFromSource();
    }
  }
}

console.log();
writeEmbeddedFiles();

console.log();
mergeHandoff();

console.log();
patchClaudeMd();

// Run ensureCanonicalFiles once and share the result with both patch functions.
console.log();
const canonicalExtra = ensureCanonicalFiles(instDst);

console.log();
patchAgentsMd(canonicalExtra);

console.log();
patchCopilotInstructions(canonicalExtra);

console.log();
console.log('Done.');
