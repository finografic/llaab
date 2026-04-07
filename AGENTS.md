# AGENTS.md - AI Assistant Guide

## New here and require INITIAL CONTEXT ?

- If **NO** initial context needed, then SKIP to NEXT section.
- If **YES**, initial context needed, then READ [Project Concept & Manifesto](</LLAAB\ -\ CONCEPT\ &\ MANIFESTO.md>)

## Rules — Project-Specific

Project-specific rules live in `.github/instructions/project/**/*.instructions.md`.

- Do not reference `@workspace/*` — all imports and deps must use published package names.

## Rules — General

Rules are canonical in `.github/instructions/` and shared across Claude Code, Cursor, and GitHub Copilot.
Follow general TypeScript, ESLint, and naming conventions from prior context.

- [General](/.github/instructions/00-general.instructions.md)
- [File Naming](/.github/instructions/01-file-naming.instructions.md)
- [TypeScript Patterns](/.github/instructions/02-typescript-patterns.instructions.md)
- [Provider & Context Patterns](/.github/instructions/03-provider-context-patterns.instructions.md)
- [ESLint & Code Style](/.github/instructions/04-eslint-code-style.instructions.md)
- [Documentation](/.github/instructions/05-documentation.instructions.md)
- [Modern TypeScript Patterns](/.github/instructions/06-modern-typescript-patterns.instructions.md)
- [Variable Naming](/.github/instructions/07-variable-naming.instructions.md)
- [README Standards](/.github/instructions/08-readme-standards.instructions.md)
- [Picocolors CLI styling](/.github/instructions/09-picocolors-cli-styling.instructions.md)
- [Git Policy](/.github/instructions/10-git-policy.instructions.md)

---

## Rules — Markdown

### Tables

- Padded pipes: one space on each side of every `|`, including the separator row.
- Align column widths so all cells in the same column are equal width.

### Links

- Use markdown link syntax when referencing another document — not bare paths or backtick references.
- Use absolute paths from the repo root (e.g. `[AGENTS.md](/AGENTS.md)`).
- Prefer em-dash `—` over hyphen-minus `-` as a heading separator — it produces a cleaner `--` slug.

### Anchor slugification

When linking to a specific section, append `#<slug>` to the path:

- Use a single `#` regardless of the target heading level (H1–H6).
- Slugify: lowercase, strip characters that are not alphanumeric, spaces, or hyphens; convert spaces to hyphens.
- **Em-dash `—`** is stripped; surrounding spaces become hyphens → `--`
  - `## Skills — Check Before Implementing` → `#skills--check-before-implementing`
- **Hyphen-minus `-`** is kept; surrounding spaces also become hyphens → `---`
  - `## Rules - General` → `#rules---general`

### Confirm before writing

Before writing any link:

1. Verify the target file exists.
2. For anchor links: read the file, find the exact heading text, derive the slug — do not guess.

---

## Git Policy

- IMPORTANT: NEVER include `Co-Authored-By` lines in commit messages. Not ever, not for any reason.
- [Git — Commits](/.github/instructions/10-git-policy.instructions.md#commits)
- [Git — Releases](/.github/instructions/10-git-policy.instructions.md#releases)

---

## Learned User Preferences

- For personal or ecosystem-only repos, keep contributor workflow in `docs/process/`; add a root `CONTRIBUTING.md` mainly when a public repo needs GitHub’s usual discoverability.

## Learned Workspace Facts

- Commitlint rule severity is numeric only (`0` / `1` / `2`); the string `error` is not valid in rule configuration.
