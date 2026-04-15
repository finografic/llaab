# AGENTS.md - AI Assistant Guide

## New here and require INITIAL CONTEXT ?

- If **NO** initial context needed, then SKIP to NEXT section.
- If **YES**, initial context needed, then READ [Project Concept & Manifesto](</LLAAB\ -\ CONCEPT\ &\ MANIFESTO.md>)

## Roadmap

**`docs/todo/ROADMAP.md` is the primary high-level plan for this project.**

- Before proposing or generating new features, check the roadmap for existing items.
- When conceiving a new feature or initiative, add it to the appropriate priority tier.
- Detailed todo docs for specific items live alongside it in `docs/todo/`.

---

## Rules — Project-Specific

Project-specific rules live in `.github/instructions/project/**/*.instructions.md`.

- Do not reference `@workspace/*` — all imports and deps must use published package names.

## Rules — Global

Rules are canonical in `.github/instructions/` and shared across Claude Code, Cursor, and GitHub Copilot.

- General: `.github/instructions/00-general.instructions.md`
- File Naming: `.github/instructions/01-file-naming.instructions.md`
- TypeScript: `.github/instructions/02-typescript-patterns.instructions.md`
- ESLint & Style: `.github/instructions/04-eslint-code-style.instructions.md`
- Documentation: `.github/instructions/05-documentation.instructions.md`
- Modern TS Patterns: `.github/instructions/06-modern-typescript-patterns.instructions.md`
- Variable Naming: `.github/instructions/07-variable-naming.instructions.md`
- README Standards: `.github/instructions/08-readme-standards.instructions.md`
- Picocolors CLI styling: `.github/instructions/09-picocolors-cli-styling.instructions.md`
- Git Policy: `.github/instructions/10-git-policy.instructions.md`
- Agent-facing Markdown: `.github/instructions/11-agent-facing-markdown.instructions.md`
- Feature Design Specs: `.github/instructions/12-feature-design-specs.instructions.md`

---

## Rules — Markdown Tables (universal)

- Padded pipes: one space on each side of every `|`, including the separator row.
- Align column widths so all cells in the same column are equal width.

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
- Commit messages use a custom Commitlint type list (`build`, `chore`, `ci`, `deps`, `docs`, `feat`, `fix`, `refactor`, `revert`, `style`, `test`); AI-related terms like `agents` and `skills` should be used as scopes, not custom types.
- Ubiquitous-language terms are defined in [`LLAAB_GLOSSARY.md`](/LLAAB_GLOSSARY.md) (the glossary artifact); **shared vocabulary** is the broader goal in prose—do not use _vocabulary_ and _glossary_ interchangeably for that file.
- YouTube transcript ingestion deduplicates existing nodes by matching `sourceType === 'youtube'` and `sourceItemId` to the video id.
