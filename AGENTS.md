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
- **Process State Architecture:** `.github/instructions/project/process-state-architecture.instructions.md`
  — Any process worth showing live status for must be durable (a `RunNode` from the moment it
  starts) and globally observable (status derived from shared query state, never page-local
  mutation state). Complements, does not relax, Agent Execution above.
- **Components:** `.github/instructions/project/components-shadcn.instructions.md`
  — shadcn/ui first; canonical component location; install procedure; token usage.
- **Component file organization:** `.github/instructions/project/component-file-organization.instructions.md`
  — folder-per-component shape for splitting up large component files; what to extract
  and where (types/utils/sub-components/shared constants); reference implementation.

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

- Ingest `IngestPipeline` and app-wide `RunMonitor` (`RunMonitorProvider` in `AppLayout`) share `RunPipelineCard`—grey collapsible RUN shell with `AiChainOfThought` steps (blue active / green complete / orange warning); monitor adds activity log and `ExtractionModelCard` metrics in the card body.
- Client `AppLayout` pages must use the canonical `PageLayout` + `<PageHero>` pattern (`layouts/PageLayout`, `components/PageHero`); do not hand-roll page headers or alternate hero markup. Use the optional `right` slot for hero-row actions (e.g. ingest clean control).
- **CSS Modules:** import as `styles` — `import styles from './Component.module.css'`; access classes as `styles.className`. Do not use `s` or other shorthand aliases.
- For in-app navigation use React Router `Link` / `useNavigate`; reserve native `<a href>` for external URLs.
- Feature **dialogs** live in `apps/client/src/dialogs/` (alongside `forms/` and `tables/` at `src/` root).
- For darker resting states on semantic outline controls (warning, error, accent), use `--*-dim` / `--*-border-dim` tokens in `app.css` rather than stacking opacity on the bright semantic colors.
- Vault entity **detail** routes wrap body content in `PageDetail`; vault **list** routes use `PageList`—except `/vault/transcripts` (+ `/:id`), which share `TranscriptsSplitView` (sidebar split; index auto-navigates to latest transcript by `created_at`). Canonical Ideas bar: count badge, bold `--consolidation-text` quality score, and Consolidate on one row; Consolidate uses `TimerIcon` + `useElapsedMs` (heartbeat, freezes on settle). Set route handle `{ fullBleed: true }` on transcript routes for full-height split views.
- **Sticky app header:** `AppHeader` is sticky on all pages (`--header-h`). Right icon actions (after optional `actions` slot): Ingest → `/ingest`, Transcripts (`VoicemailIcon`) → `/vault/transcripts`, LLM, Icons. Sidebars must use `AppSidebarLayout` with `position="inline"`—never shadcn fixed `inset-y-0` sidebars under the app header (they overlap the nav). See `.github/instructions/project/components-shadcn.instructions.md` § Sidebars.
- Tag groups use `<div class="tags">` with `tag-row` children—generic `div` for layout, not `section`/`article`; prefer `tags` over `-wrapper`/`-container` class names.
- Vault node list pages should use shadcn `DataTable` via wrappers in `apps/client/src/tables/`; avoid one-off HTML tables for node lists. In `*Table.tsx` wrappers, define column cell renderers at module scope with explicit `CellContext<T, unknown>` typing—copy `SourcesTable`/`TranscriptsTable` as templates; do not nest renderers inside `useMemo`.
- Ingest `RunsTable`: grouped rows collapsed by default; child rows align to parent columns (not a single `colSpan`); dedicated sortable **Published** column (YouTube publish date, `dd-MM-YYYY`; blank on child rows); dedicated **Nodes** column (`totalNodes` = sum of `produced_node_ids.length` per group); child-row `ExtractionModelCard` uses `showTotalTokens={false}`.
- Vault file diff viewer (`/vault?path=…&view=diff`) uses `@pierre/diffs` with theme overrides in `apps/client/src/constants/pierre-diffs-theme.ts`—Pierre Dark add/delete accent overrides, not semantic `--success-text`/`--error-text`; no per-line saturate/brightness filters. Dim the whole `.viewerFile` at `opacity: 0.7`; do not per-token `color-mix`/`brightness` (pierre-dark sets per-span colors; partial targeting looks patchy).

## Learned Workspace Facts

- In `apps/server`, each route group uses `*.schema.ts` for Zod, `*.routes.ts` for `{ path, handler }` exports with semantic names, and `index.ts` for wiring only; vault routes split by domain into `vault-*.routes.ts` with `vault.routes.ts` as a re-export barrel. `app.ts` chains `.route('/api', …)` per group router so Hono `AppType` stays correct for the RPC client.
- Zod-derived node fields and other values carried through ingestion pipelines (including YAML frontmatter) use snake_case; TypeScript and JavaScript identifiers in source code stay camelCase.
- Commitlint: rule severity is numeric only (`0` / `1` / `2`, not `error`); commit types are `build`, `chore`, `ci`, `deps`, `docs`, `feat`, `fix`, `refactor`, `revert`, `style`, `test`—use `agents` / `skills` as scopes, not custom types.
- Run `duration_ms` is wall-clock elapsed time (`completed_at − started_at`). For `ingest-youtube`, it covers only the ingestion pipeline inside `runSkill` (fetch/parse/store)—not post-run auto-extraction, which runs afterward outside the run record.
- Ubiquitous-language terms are defined in [`LLAAB_GLOSSARY.md`](/LLAAB_GLOSSARY.md) (the glossary artifact); **shared vocabulary** is the broader goal in prose—do not use _vocabulary_ and _glossary_ interchangeably for that file.
- YouTube: transcript ingestion deduplicates by `sourceType === 'youtube'` + `sourceItemId`; on `SourceNode`, `follow` is an unimplemented future LLAAB auto-refresh flag—not YouTube subscription; `youtube_subscribed` (optional Google OAuth) drives the "Following" UI.
- `@finografic/md-lint` (`pnpm run lint:md`) classifies markdown as **standard**, **agent**, or **vault** (`vault/**/*.md`). Root `.markdownlint.jsonc` rule keys apply globally; optional **`standard` / `agent` / `vault`** objects are md-lint-only scope overrides (not upstream markdownlint) merged preset → global → category.
- `graphify-out/` is gitignored—regenerated locally by husky post-commit/post-checkout hooks; agents still run `graphify query` when `graphify-out/graph.json` exists on disk.
- Client primary nav is shadcn `NavigationMenu` (`components/NavMenu/NavMenu.tsx`); menu structure lives in `apps/client/src/lib/nav-menu.config.ts`. Use `viewport={false}` so megamenu panels anchor under each trigger; rightmost sections (e.g. System) may need `left-auto right-0` on content. Responsive show/hide uses Tailwind only (`hidden md:flex`, `md:hidden`)—do not set `display` on CSS-module wrappers (overrides Tailwind `hidden` after hydration).
- **Env / client / ports:** Monorepo `.env` at repo root; Vite `envDir` points there. `LLAAB_API_URL` proxies `/api` and `/terminal` only (not in the browser bundle); do not widen Vite `envPrefix` to expose server-named vars to the client bundle. `LLAAB_API_KEY`, `VAULT_PASSWORD`, OAuth/LLM keys are server-only—client uses same-origin paths. `VITE_*` exposes client bundle vars; unset `VAULT_PASSWORD` disables vault login. Local: client **3000** (`llaab.localhost:3000`), server **8888**, icons **5001**/**5199**. macOS launchd `com.llaab.client` runs `vite dev` (HMR), not `vite preview`.
- **Canonical consolidation:** single-pass on `consolidate` LLM task (default `?mode=single-26b`); `consolidate-audit` removed. Quality validation/scoring in `packages/schemas/src/consolidation-quality.ts`; API returns `qualityValidation` (percentage score); transcript UI shows score on the Canonical Ideas bar.
- **SPA routing:** `apps/client` is a Vite + React Router SPA. Routes live in `src/routes/` and are wired in `src/router.tsx`; imports use tsconfig path aliases (`components/*`, `lib/*`, `utils/*`, …)—not `@/*`. Vault routes use `vaultSessionLoader` + nested `VaultLayout`; set `handle: { title, fullBleed? }` for `AppLayout` chrome. Data fetching uses TanStack Query hooks in `src/queries/` with a single root `QueryClientProvider` in `main.tsx`; do not pass `initialData: []` (legacy Astro SSR carryover—it marks queries fresh and can skip `/api/*` fetches).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
