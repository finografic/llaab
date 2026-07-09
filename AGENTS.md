# AGENTS.md — AI Assistant Guide

## New here and require INITIAL CONTEXT ?

- If **NO** initial context needed, then SKIP to NEXT section.
- If **YES**, initial context needed, then READ [Project Concept & Manifesto](</LLAAB\ -\ CONCEPT\ &\ MANIFESTO.md>)

## Project Memory Model

- `docs/todo/ROADMAP.md` = milestone plan, near-term tasks, and completed history.
- `.agents/handoff.md` = stable current project state.
- `.agents/memory.md` = chronological session log.

Promote durable findings from memory → handoff, priorities and follow-ups → roadmap.

Reference: [`docs/process/PROJECT_MEMORY_MODEL.md`](./docs/process/PROJECT_MEMORY_MODEL.md)

---

## Vault and Knowledge Repos

LLAAB uses a two-repo local layout:

```text
~/LLAAB/
  .git/          # parent source repo: app, packages, docs, knowledge/
  knowledge/     # promoted canonical artifacts committed with source
  vault/
    .git/        # nested private data repo: generated/runtime vault data
```

Rules:

- Parent repo commits may include app/source/docs and `knowledge/`.
- Parent repo commits must not add `vault/` contents or a `vault` gitlink/submodule.
- `vault/` commits happen from the nested vault repo with `git -C vault ...`.
- `vault/` is for runtime captures, transcripts, sources, run traces, extracted ideas,
  canonical-idea candidates, raw files, inbox drops, prompts, resources, decisions, and draft skills.
- `knowledge/` is for reviewed promoted artifacts. Canonical ideas from `vault/` are source
  ingredients for `knowledge/wikis/` and `knowledge/knowledge-graphs/`, not automatically promoted.
- Do not rewrite parent Git history to purge old `vault/` commits unless the user explicitly asks for
  a destructive history rewrite and accepts the remote coordination cost.

Reference: [`docs/process/VAULT_KNOWLEDGE_REPOS.md`](./docs/process/VAULT_KNOWLEDGE_REPOS.md)

---

## Runtime Agents

External agent files instruct tools working on this repo. Runtime agent files define agents that
LLAAB itself runs.

When generating or altering LLAAB runtime agents, agent definitions, runtime skills, MCP/tool
contracts, or related hooks/events, follow [`docs/agents/RUNTIME_AGENTS.md`](./docs/agents/RUNTIME_AGENTS.md).

Short rule:

```text
AGENTS.md / .github/instructions/ = external agents working on LLAAB
docs/agents/                   = runtime-agent architecture and implementation rules
knowledge/agents/              = promoted runtime agent definitions
knowledge/skills/              = promoted runtime/development skills
vault/                         = drafts, captures, generated candidates, traces
```

---

## Roadmap and Planning Docs

- Check `ROADMAP.md` before proposing new initiatives.
- Use `ROADMAP.md#next` for small follow-ups and manual validation.
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
- **Runtime Agents:** `.github/instructions/project/runtime-agents.instructions.md`
  — External agent files instruct tools working on LLAAB; runtime agent files define agents LLAAB
  runs. Use `docs/agents/RUNTIME_AGENTS.md` for locations and lifecycle boundaries.
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
- **Do NOT manually align column widths or pad cells to equal width.** `oxfmt` (run automatically
  by lint-staged on commit and by `pnpm format:fix`) fixes table alignment automatically. Spending
  tokens counting characters and iterating on spacing is wasted effort — write the content, let the
  formatter handle alignment.

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

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Cursor

- Always-on rules: `.cursor/rules/` (`alwaysApply` — entry point is `AGENTS.md`, same as `CLAUDE.md`)

---

## Learned User Preferences

- Ingest page: `IngestForm` URL input is monospace with green processing highlight on the active URL (no duplicate queue current-URL card); YouTube-detected hint uses `CheckIcon` + pipeline-complete green. `IngestPipeline` and app-wide `RunMonitor` share `RunPipelineCard`—grey collapsible RUN shell with `AiChainOfThought` steps (blue active / green complete / orange warning); monitor adds activity log and `ExtractionModelCard` metrics in the card body.
- Client `AppLayout` pages must use the canonical `PageLayout` + `<PageHero>` pattern (`layouts/PageLayout`, `components/PageHero`); do not hand-roll page headers or alternate hero markup. Use the optional `right` slot for hero-row actions (e.g. ingest clean control). Home dashboard card grid uses `BalancedGrid` + `balanced-grid.utils.ts`—prefers even row fills (6 cards → 3 cols not 4).
- **CSS Modules:** import as `styles` — `import styles from './Component.module.css'`; access classes as `styles.className`. Do not use `s` or other shorthand aliases.
- For in-app navigation use React Router `Link` / `useNavigate`; reserve native `<a href>` for external URLs. Feature **dialogs** live in `apps/client/src/dialogs/` (alongside `forms/` and `tables/` at `src/` root).
- **SwiftBar** (`scripts/macos/llaab-swiftbar.15s.sh`): keep the menu minimal—no overlapping refresh/restart items. **Rebuild & Reload App** (`dev-refresh.sh`) rebuilds workspace packages (incl. `@llaab/llm`) and restarts server+client; use after package/server code or `.env` changes. **Restart All** bounces launchd without a build; **Repair All** is break-glass (deps, caches, full restart). Order: Open links → separator → Rebuild & Reload App → separator → per-service status → Start/Stop/Restart All grouped → Repair/Tail log.
- **`/llm` page:** shared `llm-card-grid.module.css` responsive grid (`minmax(min(100%, 700px), 1fr)`; page ~1600px max) for model cards and task-routing cards (tier + select on one row). **OpenCode** uses **fuchsia** provider tokens in `ai-model-info.tsx`; routing/model labels `Provider: model` with provider text zinc-500. Model cards: no redundant `AiModelInfoMeta` footer; availability badges `translate-x-[10px]`. Inline loader in `PageHero` meta while `/api/llm/status` loads.
- For darker resting states on semantic outline controls (warning, error, accent), use `--*-dim` / `--*-border-dim` tokens in `app.css` rather than stacking opacity on the bright semantic colors.
- Vault entity **detail** routes wrap body content in `PageDetail`; vault **list** routes use `PageList`—except `/vault/transcripts` (+ `/:id`), which share `TranscriptsSplitView` (sidebar split; index auto-navigates to latest transcript by `created_at`). Canonical Ideas bar: count badge, bold `--consolidation-text` quality score, and Consolidate on one row; Consolidate uses `TimerIcon` + `useElapsedMs` (heartbeat, freezes on settle). Set route handle `{ fullBleed: true }` on transcript routes for full-height split views.
- **Sticky app header:** `AppHeader` is sticky on all pages (`--header-h`). Right icon actions (after optional `actions` slot): Ingest → `/ingest`, Transcripts (`VoicemailIcon`) → `/vault/transcripts`, LLM, Icons. Sidebars must use `AppSidebarLayout` with `position="inline"`—never shadcn fixed `inset-y-0` sidebars under the app header (they overlap the nav). See `.github/instructions/project/components-shadcn.instructions.md` § Sidebars.
- Vault node list pages should use shadcn `DataTable` via wrappers in `apps/client/src/tables/`; avoid one-off HTML tables for node lists. `DataTableColumnDef` supports optional per-column `maxWidth` and `maxChars` for truncation. In `*Table.tsx` wrappers, define column cell renderers at module scope with explicit `CellContext<T, unknown>` typing—copy `SourcesTable`/`TranscriptsTable` as templates; do not nest renderers inside `useMemo`.
- Ingest `RunsTable`: grouped rows collapsed by default; child rows align to parent columns (not a single `colSpan`); dedicated sortable **Published** column (YouTube publish date, `dd-MM-YYYY`; blank on child rows); dedicated **Nodes** column (`totalNodes` = sum of `produced_node_ids.length` per group); child-row `ExtractionModelCard` uses `showTotalTokens={false}`. Optional `columnLimits` prop—ingest page caps title at maxWidth 400 / maxChars 60. YouTube channels use shared `renderYouTubeSubscriptionIcon()`—green `UserCheckIcon` when `youtube_subscribed === true`, grey `UserXIcon` for `false` or unknown. `/ingest` surfaces background enrich failures via alerts between form and table—never swallow enrich errors.
- Vault file diff viewer (`/vault?path=…&view=diff`) uses `@pierre/diffs` with theme overrides in `apps/client/src/constants/pierre-diffs-theme.ts`—Pierre Dark add/delete accent overrides, not semantic `--success-text`/`--error-text`; no per-line saturate/brightness filters. Dim the whole `.viewerFile` at `opacity: 0.7`; do not per-token `color-mix`/`brightness` (pierre-dark sets per-span colors; partial targeting looks patchy).

## Learned Workspace Facts

- In `apps/server`, each route group uses `*.schema.ts` for Zod, `*.routes.ts` for `{ path, handler }` exports with semantic names, and `index.ts` for wiring only; vault routes split by domain into `vault-*.routes.ts` with `vault.routes.ts` as a re-export barrel. `app.ts` chains `.route('/api', …)` per group router so Hono `AppType` stays correct for the RPC client.
- Zod-derived node fields and other values carried through ingestion pipelines (including YAML frontmatter) use snake_case; TypeScript and JavaScript identifiers in source code stay camelCase.
- Run `duration_ms` is wall-clock elapsed time (`completed_at − started_at`). For `ingest-youtube`, it covers only the ingestion pipeline inside `runSkill`—not post-run auto-extraction. **Stale runs:** `LLAAB_RUN_STALE_MS` (default 30m consolidation; per-skill overrides when unset) auto-fails zombie RunNodes on startup and `/api/runs/monitor` poll; `LLAAB_LMSTUDIO_COMPLETION_TIMEOUT_MS` (default 20m) aborts hung LM Studio chat. Timeout env values must be plain digits (`Number('1_200_000')` → NaN).
- **Hermes layer:** Mac Studio operator gateway (separate from `apps/server`); live config in `docs/integrations/hermes.md`, phased plan in `docs/todo/TODO_HERMES_LAYER.md`. Hermes secrets live in `~/.hermes/.env` (`OPENCODE_GO_API_KEY`, `DISCORD_BOT_TOKEN`, etc.)—not repo `.env` (`OPENCODE_API_KEY` for other LLAAB tooling).
- Ubiquitous-language terms are defined in [`LLAAB_GLOSSARY.md`](/LLAAB_GLOSSARY.md) (the glossary artifact); **shared vocabulary** is the broader goal in prose—do not use _vocabulary_ and _glossary_ interchangeably for that file.
- YouTube: transcript ingestion deduplicates by `sourceType === 'youtube'` + `sourceItemId`; `youtube_subscribed` (Google OAuth + YouTube API) is set only at **enrich** in `enrichSourceMetadata`—not during ingest. Enrich runs client-side from `/ingest` (background, serialized—one source at a time) and `/vault/sources/:id` on load; mark refreshed only on success. Tracked sources auto-commit metadata (`chore(vault): refresh source metadata for …`); untracked/new ingest sources skip auto-commit so Discard still works—vault git uses a mutex and `--no-verify` on machine metadata commits. On `SourceNode`, `follow` is an unimplemented future LLAAB auto-refresh flag—not YouTube subscription; `youtube_subscribed` drives subscription UI. `GOOGLE_OAUTH_*` vars live in repo `.env`. **OAuth setup / token renewal:** [docs/integrations/youtube-oauth.md](docs/integrations/youtube-oauth.md).
- `@finografic/md-lint` (`pnpm run lint:md`) classifies markdown as **standard**, **agent**, or **vault** (`vault/**/*.md`). Root `.markdownlint.jsonc` rule keys apply globally; optional **`standard` / `agent` / `vault`** objects are md-lint-only scope overrides (not upstream markdownlint) merged preset → global → category.
- `graphify-out/` is gitignored—regenerated locally by husky post-commit/post-checkout hooks; agents still run `graphify query` when `graphify-out/graph.json` exists on disk.
- Client primary nav is shadcn `NavigationMenu` (`components/NavMenu/NavMenu.tsx`); menu structure in `apps/client/src/lib/nav-menu.config.ts` (`viewport={false}`; Tailwind `hidden md:flex` only—no `display` on CSS-module wrappers). **SPA:** routes in `src/routes/` wired in `src/router.tsx`; tsconfig aliases (`components/*`, `lib/*`, …)—not `@/*`. Vault routes use `vaultSessionLoader` + `VaultLayout`; `handle: { title, fullBleed? }` for `AppLayout`. TanStack Query in `src/queries/`; do not pass `initialData: []`.
- **Env / client / ports:** Monorepo `.env` at repo root; Vite `envDir` points there. `LLAAB_API_URL` proxies `/api` and `/terminal` only (not in the browser bundle); do not widen Vite `envPrefix`. **`PORT`** is the Vite dev port convention—keep `PORT` (not `LLAAB_PORT`). Auth: `LLAAB_API_KEY` (`X-API-Key` for API writes); optional `LLAAB_PASSWORD` (browser session for app writes); optional `VAULT_PASSWORD` (vault UI only—unset = open `/vault`). Dead vars removed: `OPENAI_API_KEY`, `LL_STATS_API_KEY`. Local: client **5050**, server **8888**, icons **5001**/**5199**. `com.llaab.client` launchd runs `vite dev` (HMR), not `vite preview`.
- **Cloud model catalog:** `configs/cloud-model-catalog.json` (gitignored) cache-first via `packages/llm/src/cloud-model-catalog.ts`; optional `GET /models` metadata refresh (no chat tokens). `/llm` badges: Installed / Cloud / Catalog / On request.
- **Canonical consolidation:** single-pass on `consolidate` LLM task (default `?mode=single-26b`); `consolidate-audit` removed. Prompts include canonical promotion rules; quality scoring in `packages/schemas/src/consolidation-quality.ts` applies theme checks only when ≥2 theme-matching candidates. API returns `qualityValidation` (percentage score); transcript UI shows score on the Canonical Ideas bar. **`extract`** and **`consolidate`** routed to OpenCode **`glm-5.2`** (`configs/llm-routing.json`).
