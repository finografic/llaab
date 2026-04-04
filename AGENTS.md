# AGENTS.md - AI Assistant Guide

Rules are canonical in `.github/instructions/` and shared across Claude Code, Cursor, and GitHub Copilot.

## Rules - General

- IMPORTANT: NEVER include `Co-Authored-By` lines in commit messages. Not ever, not for any reason.

## Rules - Markdown Tables

- Padded pipes: one space on each side of every `|`, including the separator row.
- Align column widths so all cells in the same column are equal width.

## Rule Files

> Note: the full `.github/instructions/` rule set from the monorepo has not been copied here yet.
> Until it is, follow general TypeScript, ESLint, and naming conventions from prior context.

- [General](/.github/instructions/00-general.instructions.md)
- [File Naming](/.github/instructions/01-file-naming.instructions.md)
- [TypeScript Patterns](/.github/instructions/02-typescript-patterns.instructions.md)
- [Provider & Context Patterns](/.github/instructions/03-provider-context-patterns.instructions.md)
- [ESLint & Code Style](/.github/instructions/04-eslint-code-style.instructions.md)
- [Documentation](/.github/instructions/05-documentation.instructions.md)
- [Modern TypeScript Patterns](/.github/instructions/06-modern-typescript-patterns.instructions.md)
- [Variable Naming](/.github/instructions/07-variable-naming.instructions.md)
- [README Standards](/.github/instructions/08-readme-standards.instructions.md)

## Project-Specific

Project-specific rules live in `.github/instructions/project/*.instructions.md`.

- Published to GitHub Packages (`https://npm.pkg.github.com`).
- Do not reference `@workspace/*` -— all imports and deps must use published package names.

## Commit Message Policy (LLAAB)

Use this format for all commits unless the user says otherwise.

- Subject: conventional commit style, e.g. `chore(scope): short action`.
- Body: short bullet points only.
- Keep bullets terse; prioritize brevity over grammar.
- No paragraph-style prose blocks in commit bodies.
- Do not include shell commands in commit bodies.
- Verification section is allowed, but keep each line short, e.g. `- workspace typecheck OK`.
- Preserve real newlines in commit bodies; never use escaped `\\n` literals.
- Prefer writing commit messages via `git commit -F <message-file>` for multiline safety.
- If a commit body format is wrong, amend immediately.
