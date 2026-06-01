# AGENTS.md - AI Assistant Guide

## New here and require INITIAL CONTEXT ?

- If **NO** initial context needed, then SKIP to NEXT section.
- If **YES**, initial context needed, then READ [Project Concept & Manifesto](</LLAAB\ -\ CONCEPT\ &\ MANIFESTO.md>)

## Project Memory Model

- `docs/todo/ROADMAP.md` = curated milestone plan + completed milestone history.
- `docs/todo/NEXT_STEPS.md` = near-term working list, manual testing, and small follow-ups.
- `.agents/handoff.md` = current project state snapshot.
- `.agents/memory.md` = chronological working memory / session log.

Promotion rule:

- session detail, partial work, and temporary context belong in `.agents/memory.md`
- stable current truth belongs in `.agents/handoff.md`
- project priorities and completed milestone-scale work belong in `ROADMAP.md`
- small actionable follow-ups and manual verification belong in `NEXT_STEPS.md`

Do not duplicate the same item across all four files unless it truly belongs in each role.

Reference: [`docs/process/PROJECT_MEMORY_MODEL.md`](./docs/process/PROJECT_MEMORY_MODEL.md)

---

## Roadmap and Planning Docs

- Before proposing or generating new features, check `ROADMAP.md` for existing priorities.
- When conceiving a new feature or initiative, add it to the appropriate roadmap tier.
- Use `NEXT_STEPS.md` for concrete follow-ups, manual validation, and small tasks that do not need full roadmap treatment.
- Detailed feature planning docs live in `docs/todo/` as `TODO_*.md` (active) or `DONE_*.md` (complete).
- **TODO/DONE doc conventions:** `.github/instructions/documentation/todo-done-docs.instructions.md`
  — rules for naming, status headers, checkboxes, and graduating `TODO_` → `DONE_`.

---

## Rules — Components

Full detail: `.github/instructions/project/components-shadcn.instructions.md`

**shadcn/ui first — always.** Before writing any custom component, icon, or layout
primitive, check whether shadcn or Lucide already covers it. If they do, use them.
Hand-rolling what shadcn provides is not permitted.

- **Icons:** always use `lucide-react`. Never write raw `<svg>` for icons Lucide covers.
- **Primitives:** buttons, inputs, cards, badges, dialogs, tables, tooltips, etc.
  all come from shadcn — install them, don't rebuild them.
- **CSS values:** use shadcn tokens (`var(--primary)`, `var(--border)`, etc.) or LLAAB
  app tokens (`var(--accent)`, `var(--surface)`, etc.). Never hard-code hex/rgb colours
  in components or layouts.

**Canonical component location:** `packages/ui/src/components/`

- `pnpm dlx shadcn@latest add <name>` run from `apps/client` installs there automatically.
- The `components/ui/*` tsconfig alias in `apps/client` resolves to that path — no
  import changes needed when adding components.
- App-specific feature components (IngestForm, NavbarVertical, etc.) stay in
  `apps/client/src/components/` and import primitives from `components/ui/*`.

---

## Rules — Project-Specific

Project-specific rules live in `.github/instructions/project/**/*.instructions.md`.

- Do not reference `@workspace/*` — all imports and deps must use published package names.
- **Agent Execution:** `.github/instructions/project/agent-execution.instructions.md`
  — No always-on background processes, file watchers, or polling loops. All automation
  uses the one-shot processor pattern (explicit trigger → run → exit). LLAAB does not
  own a scheduler. This rule is non-negotiable.
- **Components:** `.github/instructions/project/components-shadcn.instructions.md`
  — shadcn/ui first; canonical component location; install procedure; token usage.

## Rules — Global

Rules are canonical in `.github/instructions/` — see `README.md` there for folder structure.
Shared across Claude Code, Cursor, and GitHub Copilot.

**General**

- General baseline: `.github/instructions/general.instructions.md`

**Code**

- TypeScript patterns: `.github/instructions/code/typescript-patterns.instructions.md`
- Modern TS patterns: `.github/instructions/code/modern-typescript-patterns.instructions.md`
- Oxlint & style: `.github/instructions/code/linting-code-style.instructions.md`
- Provider/context patterns: `.github/instructions/code/provider-context-patterns.instructions.md`
- Picocolors CLI styling: `.github/instructions/code/picocolors-cli-styling.instructions.md`

**Naming**

- File naming: `.github/instructions/naming/file-naming.instructions.md`
- Variable naming: `.github/instructions/naming/variable-naming.instructions.md`

**Documentation**

- Documentation: `.github/instructions/documentation/documentation.instructions.md`
- README standards: `.github/instructions/documentation/readme-standards.instructions.md`
- Agent-facing markdown: `.github/instructions/documentation/agent-facing-markdown.instructions.md`
- Feature design specs: `.github/instructions/documentation/feature-design-specs.instructions.md`
- TODO/DONE docs: `.github/instructions/documentation/todo-done-docs.instructions.md`

**Git**

- Git policy: `.github/instructions/git/git-policy.instructions.md`

---

## Rules — Markdown Tables

- Padded pipes: one space on each side of every `|`, including the separator row.
- Align column widths so all cells in the same column are equal width.

---

## Git Policy

- IMPORTANT: NEVER include `Co-Authored-By` lines in commit messages. Non-negotiable.
- `.github/instructions/git/git-policy.instructions.md` (see Commits and Releases sections)

---

## Learned User Preferences

- For personal or ecosystem-only repos, keep contributor workflow in `docs/process/`; add a root `CONTRIBUTING.md` mainly when a public repo needs GitHub’s usual discoverability.

## Learned Workspace Facts

- In `apps/server`, each route group uses `*.schema.ts` for Zod, `*.routes.ts` for `{ path, handler }` exports with semantic names, and `index.ts` for wiring only; `app.ts` chains `.route('/api', …)` per group router so Hono `AppType` stays correct for the RPC client.
- Zod-derived node fields and other values carried through ingestion pipelines (including YAML frontmatter) use snake_case; TypeScript and JavaScript identifiers in source code stay camelCase.
- Commitlint rule severity is numeric only (`0` / `1` / `2`); the string `error` is not valid in rule configuration.
- Commit messages use a custom Commitlint type list (`build`, `chore`, `ci`, `deps`, `docs`, `feat`, `fix`, `refactor`, `revert`, `style`, `test`); AI-related terms like `agents` and `skills` should be used as scopes, not custom types.
- Ubiquitous-language terms are defined in [`LLAAB_GLOSSARY.md`](/LLAAB_GLOSSARY.md) (the glossary artifact); **shared vocabulary** is the broader goal in prose—do not use _vocabulary_ and _glossary_ interchangeably for that file.
- YouTube transcript ingestion deduplicates existing nodes by matching `sourceType === 'youtube'` and `sourceItemId` to the video id.
- `@finografic/md-lint` (`pnpm run lint:md`) classifies markdown as **standard**, **agent**, or **vault** (`vault/**/*.md`). Root `.markdownlint.jsonc` rule keys apply globally; optional **`standard` / `agent` / `vault`** objects are md-lint-only scope overrides (not upstream markdownlint) merged preset → global → category.
