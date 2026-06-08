# AGENTS.md — AI Assistant Guide

## New here and require INITIAL CONTEXT ?

- If **NO** initial context needed, then SKIP to NEXT section.
- If **YES**, initial context needed, then READ [Project Concept & Manifesto](</LLAAB\ -\ CONCEPT\ &\ MANIFESTO.md>)

## Project Memory Model

- `docs/todo/ROADMAP.md` = milestone plan and completed history.
- `docs/todo/NEXT_STEPS.md` = near-term tasks and manual checks.
- `.agents/handoff.md` = stable current project state.
- `.agents/memory.md` = chronological session log.

Promote durable findings from memory → handoff, priorities → roadmap, and concrete follow-ups → next steps.

Reference: [`docs/process/PROJECT_MEMORY_MODEL.md`](./docs/process/PROJECT_MEMORY_MODEL.md)

---

## Roadmap and Planning Docs

- Check `ROADMAP.md` before proposing new initiatives.
- Use `NEXT_STEPS.md` for small follow-ups and manual validation.
- Keep detailed plans in `docs/todo/TODO_*.md`; graduate completed plans to `DONE_*.md`.
- Follow `.github/instructions/documentation/todo-done-docs.instructions.md`.

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

- Do not include `Co-Authored-By` lines in commit messages.
- `.github/instructions/git/git-policy.instructions.md` (see Commits and Releases sections)

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
- App-specific feature components (NavMenu, PageHero, etc.) stay in `apps/client/src/components/`.
  **Forms** live in `apps/client/src/forms/`; vault **tables** in `apps/client/src/tables/`.
  Import via `forms/*` and `tables/*` tsconfig aliases. Shadcn primitives: `components/ui/*`.

---

## Learned User Preferences

- For personal or ecosystem-only repos, keep contributor workflow in `docs/process/`; add a root `CONTRIBUTING.md` mainly when a public repo needs GitHub’s usual discoverability.
- Client `AppLayout` pages must use the canonical `PageLayout` + `<PageHero slot="hero">` pattern (`PageLayout.astro`, `PageHero.astro`); do not hand-roll page headers or alternate hero markup. Use the optional `right` slot for hero-row actions (e.g. ingest clean control).
- **CSS Modules:** import as `styles` — `import styles from './Component.module.css'`; access classes as `styles.className`. Do not use `s` or other shorthand aliases.
- In Astro headers and other static nav controls, use native `<a href>` with `buttonVariants` for route shortcuts—not React `Button` with `onClick`—so navigation works without client hydration.
- Feature **dialogs** live in `apps/client/src/dialogs/` (alongside `forms/` and `tables/` at `src/` root).
- For darker resting states on semantic outline controls (warning, error, accent), use `--*-dim` / `--*-border-dim` tokens in `app.css` rather than stacking opacity on the bright semantic colors.
- Vault entity **detail** routes wrap body content in `PageDetail.astro`; vault **list** routes use `PageList.astro`—do not duplicate `.detail-page` / list-column markup per page.
- Vault node list pages should use shadcn `DataTable` via wrappers in `apps/client/src/tables/`; avoid one-off HTML tables for node lists. In `*Table.tsx` wrappers, define column cell renderers at module scope with explicit `CellContext<T, unknown>` typing—copy `SourcesTable`/`TranscriptsTable` as templates; do not nest renderers inside `useMemo`.

## Learned Workspace Facts

- In `apps/server`, each route group uses `*.schema.ts` for Zod, `*.routes.ts` for `{ path, handler }` exports with semantic names, and `index.ts` for wiring only; `app.ts` chains `.route('/api', …)` per group router so Hono `AppType` stays correct for the RPC client.
- Zod-derived node fields and other values carried through ingestion pipelines (including YAML frontmatter) use snake_case; TypeScript and JavaScript identifiers in source code stay camelCase.
- Commitlint: rule severity is numeric only (`0` / `1` / `2`, not `error`); commit types are `build`, `chore`, `ci`, `deps`, `docs`, `feat`, `fix`, `refactor`, `revert`, `style`, `test`—use `agents` / `skills` as scopes, not custom types.
- Run `duration_ms` is wall-clock elapsed time (`completed_at − started_at`). For `ingest-youtube`, it covers only the ingestion pipeline inside `runSkill` (fetch/parse/store)—not post-run auto-extraction, which runs afterward outside the run record.
- Ubiquitous-language terms are defined in [`LLAAB_GLOSSARY.md`](/LLAAB_GLOSSARY.md) (the glossary artifact); **shared vocabulary** is the broader goal in prose—do not use _vocabulary_ and _glossary_ interchangeably for that file.
- YouTube transcript ingestion deduplicates existing nodes by matching `sourceType === 'youtube'` and `sourceItemId` to the video id.
- `@finografic/md-lint` (`pnpm run lint:md`) classifies markdown as **standard**, **agent**, or **vault** (`vault/**/*.md`). Root `.markdownlint.jsonc` rule keys apply globally; optional **`standard` / `agent` / `vault`** objects are md-lint-only scope overrides (not upstream markdownlint) merged preset → global → category.
- ESLint is removed repo-wide; oxlint + oxfmt (`@finografic/oxc-config`) handle TS/JS lint and format; Prettier remains only for Astro files in `apps/client`.
- TypeScript is pinned to 6.x via root `pnpm.overrides`; TS 6 no longer auto-includes `@types/*`—set explicit `compilerOptions.types` (base: `["node"]`, `apps/server`: `["node", "bun"]`).
- In `apps/client`, imports use tsconfig path aliases (`components/*`, `lib/*`, `utils/*`, …)—not `@/*`.
- Client primary nav is shadcn `NavigationMenu` (`components/NavMenu/NavMenu.tsx`); menu structure lives in `apps/client/src/lib/nav-menu.config.ts`. Use `viewport={false}` so megamenu panels anchor under each trigger; rightmost sections (e.g. System) may need `left-auto right-0` on content. Responsive show/hide uses Tailwind only (`hidden md:flex`, `md:hidden`)—do not set `display` on CSS-module wrappers (overrides Tailwind `hidden` after hydration).
- Workspace `.vscode/settings.json` excludes `dist/`, `.astro/`, and `node_modules/` from cssvar and Tailwind IntelliSense scanning; limits cssvar to source CSS under `apps/client/src/` and `packages/ui/src/`.
