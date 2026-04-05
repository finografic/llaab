# AGENTS.md - AI Assistant Guide

## New here and require INITIAL CONTEXT ?

- If **NO** initial context needed, then SKIP to NEXT section.
- If **YES**, initial context needed, then READ [Project Concept & Manifesto](</LLAAB\ -\ CONCEPT\ &\ MANIFESTO.md>)

## Rules - General

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

## Rules - Project-Specific

Project-specific rules live in `.github/instructions/project/*.instructions.md`.

- Published to GitHub Packages (`https://npm.pkg.github.com`).
- Do not reference `@workspace/*` -— all imports and deps must use published package names.

## Rules - Markdown Tables

- Padded pipes: one space on each side of every `|`, including the separator row.
- Align column widths so all cells in the same column are equal width.

## Commit Message Policy (LLAAB)

- IMPORTANT: NEVER include `Co-Authored-By` lines in commit messages. Not ever, not for any reason.

Use this format for all commits unless the user says otherwise.

- Subject: conventional commit style, e.g. `chore(scope): short action`. Allowed **types** are enforced by `commitlint.config.mjs` (see `docs/process/DEVELOPER_WORKFLOW.md`); use **scopes** such as `agents`, `skills`, or package names for area.
- Body: terse bullets points; prioritize brevity over grammar.
- Verification section is allowed, but keep each line short, e.g. `- workspace typecheck OK`.
- Preserve real newlines in commit bodies; never use escaped `\\n` literals.
- Prefer writing commit messages via `git commit -F <message-file>` for multiline safety.

## Learned User Preferences

- For personal or ecosystem-only repos, keep contributor workflow in `docs/process/`; add a root `CONTRIBUTING.md` mainly when a public repo needs GitHub’s usual discoverability.

## Learned Workspace Facts

- Commitlint rule severity is numeric only (`0` / `1` / `2`); the string `error` is not valid in rule configuration.
