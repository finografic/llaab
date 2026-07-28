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

## Agent execution efficiency

Prefer the smallest complete implementation and validation loop appropriate to the task.

For localized feature work, target one orientation pass, one coherent edit pass, and one focused validation pass. Additional loops must be justified by a concrete failure or newly discovered dependency.

Avoid side quests. Do not broaden the task into adjacent refactors, repository cleanup, environment repair, architectural generalization, or unrelated warning resolution unless required to complete or validate the requested change.

### Before editing

- Perform one focused orientation pass over the owning route, service, storage primitive, client query/mutation, and directly affected UI.
- Read applicable repository instructions before implementing so project conventions are not discovered during final linting.
- Do not broadly inspect adjacent subsystems unless the initial pass reveals a concrete dependency.
- Once the owning surfaces are identified, begin implementation rather than continuing exploratory reads.

### Implementation scope

- Keep route handlers thin and place domain behaviour in the existing owning service layer.
- Reuse established repository patterns before introducing new abstractions.
- Do not generalize a one-use component or helper unless reuse is immediate, obvious, and materially reduces duplication.
- Avoid unrelated refactors, cleanup, generated-file changes, or environment repairs.
- Preserve unrelated uncommitted files and existing warnings.

### Validation scope

Use progressive validation, stopping once the changed behaviour is sufficiently proven:

1. Run the narrowest relevant test or test file.
2. Run typechecks for directly affected packages/apps.
3. Run formatting or lint checks only for touched files when supported.
4. Run broader builds or repository-wide checks only when:
   - the change affects shared public exports;
   - a focused check cannot establish correctness;
   - a failure specifically requires the broader command; or
   - the user explicitly requests full validation.

For CI-drift or branch-handoff work, include `pnpm format:check` with the verification pass.
Pre-commit formatting is staged-file-only and does not prove the full repository is formatted.

Do not rebuild dependent packages merely because checked-in or local `dist` output is stale unless the affected consumer actually resolves through that output. Prefer source-level validation when the workspace supports it.

Do not restart or refresh running applications unless required to verify runtime behaviour. Report that a restart may be needed instead of performing unrelated environment management.

### Tool loops and progress updates

- Resolve routine feature work in as few useful tool loops as possible.
- Batch related searches and file reads.
- Batch coherent edits where confidence is high.
- Avoid repeating equivalent commands through different wrappers unless the first result is genuinely insufficient.
- Give progress updates only at meaningful phase boundaries:
  - orientation complete;
  - implementation complete;
  - validation result or blocker.
- Do not narrate every search, file read, command, or minor implementation decision.

### Existing failures

- Distinguish failures caused by the current change from pre-existing warnings or failures.
- Do not fix unrelated failures unless they block validation of the requested work.
- Clearly report unrelated failures in the final summary.

---

## Roadmap and Planning Docs

- Check `ROADMAP.md` before proposing new initiatives.
- Use `ROADMAP.md#next` for small follow-ups and manual validation.
- Keep detailed plans in `docs/todo/TODO_*.md`; graduate completed plans to `DONE_*.md`.
- Follow `.github/instructions/documentation/todo-done-docs.instructions.md`.

---

## Rules — Project-Specific

## LLAAB-specific implementation conventions

- Structural horizontal and vertical layouts must use the local `Row` and `Col` components rather than ad hoc Tailwind flex containers.
- Server route modules should contain request parsing and response mapping only; domain workflows belong in a named service file.
- When a shared workspace package is consumed through generated `dist`, rebuild only that affected package, not the wider workspace.
- Query mutations must invalidate only the directly affected query families unless graph-wide data has changed.
- Destructive knowledge actions require explicit confirmation and must preserve referential integrity.

Project-specific rules live in `.github/instructions/project/**/*.instructions.md`.

- **Rebuild & Reload (agents):** After changing `apps/server/**`, server-consumed `packages/**`, or root `.env` values the running process reads at start, agents **must** trigger SwiftBar’s **Rebuild & Reload App** path before asking the user to verify in the browser — do not leave reload to the user. Run `mkdir -p "$HOME/Library/Logs/llaab" && ./scripts/macos/dev-refresh.sh` (same as the menu item). If that fails, fall back to `./scripts/macos/llaab-service.sh stop-server && … start-server` (and client if needed). Cursor always-on rule: `.cursor/rules/dev-refresh.mdc`.
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
- **Grid layout (mandatory):** `.cursor/rules/grid-layout.mdc` — use `Row` / `Col` / `Container`
  from `components/ui/grid` for **all structural layout blocks** (page, card, row, section splits);
  do not use Tailwind `flex` / `grid` / `grid-cols-*` for column structure. Docs:
  [`docs/components/grid.md`](./docs/components/grid.md).

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

### Upstream Sync Before Work

- Before beginning or resuming non-trivial work on the main checkout, run `git fetch origin --prune`
  and inspect `git status --short --branch`.
- If the checkout is on `master`, clean, and behind `origin/master`, update it with
  `git pull --ff-only` before editing.
- If the checkout has local changes, is on a feature branch, or has diverged from upstream, do not
  auto-pull/rebase/merge. Report the state and choose an explicit path that preserves local work.
- Do not use background auto-fetch/watchers for this repo; sync is a one-shot pre-work check.

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

## Cursor

- Always-on rules: `.cursor/rules/` (`alwaysApply` — entry point is `AGENTS.md`, same as `CLAUDE.md`)

---

## Learned User Preferences

- Ingest page: `IngestForm` URL input is monospace with green processing highlight on the active URL (no duplicate queue current-URL card); YouTube-detected hint uses `CheckIcon` + pipeline-complete green. `IngestPipeline` and app-wide `RunMonitor` share `RunPipelineCard`—grey collapsible RUN shell with `AiChainOfThought` steps (blue active / green complete / orange warning); monitor adds activity log and `ExtractionModelCard` metrics in the card body. RunMonitor sidebar: status icon left of title (same check / blue spinner / red X as Runs table); dismiss X between latency and chevron (not only when expanded); entry width should flex with sidebar space (same approach as empty “No recent runs”), not a fixed px max. ACTIVE/RECENT headings use `section__count` badges beside titles; empty state is `--text-sm` / `--text-faint`; only pending/running runs auto-expand (`defaultOpen` on active only)—failed and completed start collapsed.
- **Client pages & controls:** `AppLayout` pages use canonical `PageLayout` + `<PageHero>` (optional `right` slot for hero actions); home dashboard uses `BalancedGrid` + `balanced-grid.utils.ts` (prefers even row fills). In-app nav via React Router `Link` / `useNavigate` (native `<a>` external only). Dialogs in `apps/client/src/dialogs/`. CSS Modules import as `styles` (not shorthand). Shared `Label` with `--text-muted`. Global inputs (`white/33` / `black/33`), buttons (`font-semibold`), drop zones (accent on drag only), tabs (`variant="line"`, `text-base`, wider triggers). Semantic outline controls use `--*-dim` / `--*-border-dim` tokens. **Accordion vs Collapsible (`packages/ui`):** both canonize left `ChevronRightIcon` disclosure at source (`›` collapsed / `⌄` expanded via 90° rotate)—do not hand-roll trailing chevrons; Accordion = multi-section, Collapsible = single panel.
- **`/terminal` page:** WebSocket at `/terminal/ws`; route handle `{ fillHeight: true }` with `PageLayout fillHeight` for contained scrolling. Accordion sidebar actions are label-only monospace (no green code); detail panel under command input shows label + accent-green mono command—align text to section icons via list padding, not negative margins (scroll areas clip horizontal bleed). Command input uses `InputGroup` left-slot dim-grey X clear. **Output:** / **Recent:** labels use `font-weight: 600` with colon suffix. Shell session + connected badges sit on the **Output:** row (right-aligned after mode toggles)—no separate status row.
- **SwiftBar** (`scripts/macos/llaab-swiftbar.15s.sh`): keep the menu minimal—no overlapping refresh/restart items. **Rebuild & Reload App** (`dev-refresh.sh`) rebuilds workspace packages (incl. `@llaab/llm`) and restarts server+client; agents must run it after package/server/`.env` changes (see Rules — Project-Specific and `.cursor/rules/dev-refresh.mdc`)—do not leave reload to the user. Script creates `~/Library/Logs/llaab` before logging. **Restart All** bounces launchd without a build; **Repair All** is break-glass (deps, caches, full restart). Order: Open links → separator → Rebuild & Reload App → separator → per-service status → Start/Stop/Restart All grouped → Repair/Tail log.
- **`/llm` page:** shared `llm-card-grid.module.css` responsive grid (`minmax(min(100%, 700px), 1fr)`; page ~1600px max) for model cards and task-routing cards (tier + select on one row). **OpenCode** uses **fuchsia** provider tokens in `ai-model-info.tsx`; routing/model labels `Provider: model` with provider text zinc-500. Model cards: no redundant `AiModelInfoMeta` footer; availability badges `translate-x-[10px]`. Inline loader in `PageHero` meta while `/api/llm/status` loads.
- Vault entity **detail** routes wrap body content in `PageDetail`; vault **list** routes use `PageList`—except `/vault/transcripts` (+ `/:id`), which share `TranscriptsSplitView` (sidebar split; index auto-navigates to latest transcript by `created_at`). `/vault` file tree (`VaultFileTree`) starts all sections collapsed (`initialExpansion: 'closed'`); `?path=` navigation still expands ancestors. Sidebar transcript cards: titles always white (including selected); active card uses a 4px left accent-green indicator (inset shadow or transparent peer borders—no layout shift), not a green fill or full border; date left / `{n} ideas` right (font-weight 600 always; purple `--consolidation-text` + `BadgeCheckIcon` only when consolidated, else muted grey); author in accent green as an internal `Link` to the author page (stop card navigation); description body slightly larger than default. Extraction runs table: `dd-MM-YYYY` dates, no total-tokens `#` prefix, provider before model. Canonical Ideas bar: count badge, bold `--consolidation-text` quality score, and Consolidate on one row; Consolidate uses `TimerIcon` + `useElapsedMs` (heartbeat, freezes on settle). Canonical idea cards: dim-purple 4px left border only (no purple fill/full border; square top-left/bottom-left corners); first metadata row is confidence • sources (purple) left / date generated (grey) right. Transcript body and Extracted Ideas both use `Collapsible` (Extracted Ideas: expanded by default when not consolidated, collapsed when consolidated). Create-wiki-draft checkboxes use dim purple (not accent green) and should be checked when consolidation finishes. Transcript heading shows a YouTube-style duration badge (`mm:ss` under 1h, `h:mm:ss` at/over 1h) from the last `<!-- t:… -->` body marker—omit when none. Set route handle `{ fullBleed: true }` on transcript routes for full-height split views. **Transcript TTS (`TtsPlayer`):** prefer Kokoro `dtype="fp32"` + `device="webgpu"` (best quality/latency); with that combo keep normal `.` splits (no `fullStopChar` replacements). Inter-chunk delay includes next-chunk synthesis/load latency—coarser blank-line/paragraph chunking can help if gaps remain. When skipping transcript metadata / `## Transcript`, still speak `#` titles. Also mount on knowledge wiki content cards (top-right inside the content card).
- **Sticky app header:** `AppHeader` is sticky on all pages (`--header-h`). Right icon actions (after optional `actions` slot): Ingest → `/ingest`, Transcripts (`VoicemailIcon`) → `/vault/transcripts`, LLM, Inbox (`InboxIcon`) → `/vault/inbox`, Icons. **Secondary navbar** sits just below the main nav and always lists the current parent section’s sub-items as internal links (active = accent green); reserve its height so layout does not jump when the parent changes; disabled/locked items render disabled with a lock icon like the megamenu dropdown. Sidebars must use `AppSidebarLayout` with `position="inline"`—never shadcn fixed `inset-y-0` sidebars under the app header (they overlap the nav). See `.github/instructions/project/components-shadcn.instructions.md` § Sidebars. Layout-level shadcn toasts: status icon in a small left column (left-aligned); message in a second column that fills remaining width (left-aligned)—same two-column layout for all toast statuses.
- Vault node list pages should use shadcn `DataTable` via wrappers in `apps/client/src/tables/`; avoid one-off HTML tables for node lists. `DataTableColumnDef` supports optional per-column `maxWidth` and `maxChars` for truncation. In `*Table.tsx` wrappers, define column cell renderers at module scope with explicit `CellContext<T, unknown>` typing—copy `SourcesTable`/`TranscriptsTable` as templates; do not nest renderers inside `useMemo`.
- Ingest `RunsTable`: grouped rows collapsed by default; child rows align to parent columns (not a single `colSpan`); dedicated sortable **Published** column (YouTube publish date, `dd-MM-YYYY`; blank on child rows); **Nodes** column between Title and Date (`totalNodes` = sum of `produced_node_ids.length` per group); purple `BadgeCheckIcon` beside Nodes when `group.isConsolidated` (canonical ideas consolidated). Child rows use two `ExtractionModelCard`s in one space-between cell—provider+model left under Date; tokens+latency right-aligned with parent Latency. Latency **values** (not header) shifted left ~`1.5rem`. Run status: completed = green `CheckCircleIcon` (aligned with RunsGroupHeader numeric badges—not a text badge); extracting = blue spinner only (no badge); failed = red X icon. Optional `columnLimits` prop—ingest page caps title at ~`20rem` / maxChars 60. YouTube channels use shared `renderYouTubeSubscriptionIcon()`—green `UserCheckIcon` when `youtube_subscribed === true`, grey `UserXIcon` for `false` or unknown. External subject links at 0.66 opacity, hover 1.0. `/ingest` surfaces background enrich failures via alerts between form and table—never swallow enrich errors. `/crons`: install toggle is **installed** / **not installed** (crontab line present); show separate health (`ok` / `stale` / `failing` / `never_ran`)—never treat install alone as “enabled/working”.
- Vault file diff viewer (`/vault?path=…&view=diff`) uses `@pierre/diffs` with theme overrides in `apps/client/src/constants/pierre-diffs-theme.ts`—Pierre Dark add/delete accent overrides, not semantic `--success-text`/`--error-text`; no per-line saturate/brightness filters. Dim the whole `.viewerFile` at `opacity: 0.7`; do not per-token `color-mix`/`brightness` (pierre-dark sets per-span colors; partial targeting looks patchy).
- **`/vault/inbox` operational UI:** saved views are URL-backed filters (not server records)—All, Needs attention, Action-backed, Links, Docs, Code, Attachments, Todos, Raw (do not put Unreviewed in that main chip list); separate review-scope control uses radio-style tabs **Unreviewed | Reviewed | Both** (not ToggleGroup dual-off; do not label review scope “All”). Never create `inbox:failed` captures—failed is not a first-class triage state. Actionable summary metrics; independently collapsible capture groups; semantic badges; dense rows (route-kind icons, media thumbnails, monospace code/command previews, domain+path links); list datetimes use project standard `dd-mm-yyyy hh:mm`. Leading row checkboxes need padding before the thumbnail/title; copy/delete actions stay at the end of the row. Telegram command candidates are copy-only. Batch archive applies to reviewed captures only; batch delete (checkboxes + confirm) is irreversible vault delete, not archive. Filter/scope changes must stay cheap (client-side)—not multi-second recomputes.
- **Wiki UX:** Prefer one-step Create Wiki → auto-generate focused wiki(s) → auto-promote to `knowledge/wikis` and show the rendered article (drafts are intermediate/recovery, not the goal; minimize required review steps). Auto model-generated titles/topic IDs (no manual title/id fields in the create flow); multiple selected canonical ideas may yield several focused wikis, not one mega-article. Promoted pages must render Markdown (not raw source); surface status/quality/revision/source verification; tag pills match transcript tag colors. Related links/shared tags should grow a knowledge graph. “Focused wikis created and published” (and similar success lists) should be a vertical middot (`•`) bullet list, not an inline space-wrapped run. Wiki list: two parent columns (content + always far-right vertically centered delete); left column stacks title, description+dates, then color-coded tags; right column is compact metrics (responsive: >1280px content:metrics 60:40, ≤1280px 50:50). Compact metrics hide the large second text row, drop card borders/vertical padding, use a tightened 2-card evidence layout (Knowledge basis / Source diversity), and dim metric subtitles. Commit generated `knowledge/wikis/*.md` only when explicitly requested; deleting promoted wikis must not leave orphaned links/references.

## Learned Workspace Facts

- In `apps/server`, each route group uses `*.schema.ts` for Zod, `*.routes.ts` for `{ path, handler }` exports with semantic names, and `index.ts` for wiring only; vault routes split by domain into `vault-*.routes.ts` with `vault.routes.ts` as a re-export barrel. `app.ts` chains `.route('/api', …)` per group router so Hono `AppType` stays correct for the RPC client. Zod-derived node fields and other values carried through ingestion pipelines (including YAML frontmatter) use snake_case; TypeScript and JavaScript identifiers in source code stay camelCase.
- Run `duration_ms` is wall-clock elapsed time (`completed_at − started_at`). For `ingest-youtube`, it covers only the ingestion pipeline inside `runSkill`—not post-run auto-extraction. **Orphaned runs:** on server boot, every still-`pending`/`running` RunNode is failed immediately (`reconcileOrphanedActiveRuns`) — handlers are in-process only and do not survive restart. **Stale runs:** `LLAAB_RUN_STALE_MS` (default 30m consolidation; per-skill overrides when unset) is the hung-alive backstop on `/api/runs/monitor` poll when the server stayed up; `LLAAB_LMSTUDIO_COMPLETION_TIMEOUT_MS` (default 20m) aborts hung LM Studio chat. Timeout env values must be plain digits (`Number('1_200_000')` → NaN).
- **Hermes layer:** Mac Studio operator gateway (separate from `apps/server`); live config in `docs/integrations/hermes.md`, phased plan in `docs/todo/TODO_HERMES_LAYER.md`. Hermes secrets live in `~/.hermes/.env` (`OPENCODE_GO_API_KEY`, `DISCORD_BOT_TOKEN`, etc.)—not repo `.env` (`OPENCODE_API_KEY` for other LLAAB tooling). Inbox `npm_package` pins via `POST /api/registry/pins` (npmjs + npmx.dev; 409 = already pinned); `github_repo` still saves an IdeaNode (`inbox:github`), not a registry repo pin—gap vs UI/`POST /api/registry/repo-pins`.
- Ubiquitous-language terms are defined in [`LLAAB_GLOSSARY.md`](/LLAAB_GLOSSARY.md) (the glossary artifact); **shared vocabulary** is the broader goal in prose—do not use _vocabulary_ and _glossary_ interchangeably for that file.
- YouTube: transcript ingestion deduplicates by `sourceType === 'youtube'` + `sourceItemId`; `youtube_subscribed` (Google OAuth + YouTube API) is set only at **enrich** in `enrichSourceMetadata`—not during ingest. Enrich runs client-side from `/ingest` (background, serialized—one source at a time) and `/vault/sources/:id` on load; mark refreshed only on success. `POST /api/vault/sources/:id/enrich` must stay in server `LONG_RUNNING_PATHS` (disable Bun’s 10s idle timeout)—otherwise Vite returns 502 empty body after the file write but before commit/response. Tracked sources auto-commit metadata in the nested `vault/` (`llaab-vault`) repo (`chore(vault-auto): refresh source metadata for …`); untracked/new ingest sources skip auto-commit so Discard still works—vault git uses `VAULT_ROOT` cwd, a mutex, and `--no-verify` on machine metadata commits. On `SourceNode`, `follow` is an unimplemented future LLAAB auto-refresh flag—not YouTube subscription; `youtube_subscribed` drives subscription UI. `GOOGLE_OAUTH_*` vars live in repo `.env`. **OAuth setup / token renewal:** [docs/integrations/youtube-oauth.md](docs/integrations/youtube-oauth.md).
- `@finografic/md-lint` (`pnpm run lint:md`) classifies markdown as **standard**, **agent**, or **vault** (`vault/**/*.md`). Root `.markdownlint.jsonc` rule keys apply globally; optional **`standard` / `agent` / `vault`** objects are md-lint-only scope overrides (not upstream markdownlint) merged preset → global → category.
- **Grid layout (mandatory):** **Always** use `Row`/`Col`/`Container` from `components/ui/grid` for
  structural layout — page sections, card bodies, form rows, toolbars, multi-column splits. Do **not**
  use Tailwind `flex`/`grid`/`grid-cols-*` for column structure. Docs:
  [`docs/components/grid.md`](docs/components/grid.md); app-wide migration complete —
  [`docs/todo/DONE_GRID_LAYOUT_MIGRATION.md`](docs/todo/DONE_GRID_LAYOUT_MIGRATION.md). Reference call
  sites: `crons.tsx`, `inbox.tsx`, registry list/detail, `TerminalPanel/` (`Col lg="content"`). Feature
  components use named subfolders per component-file-organization (e.g. `terminal-panel.constants.ts` +
  `terminal-panel.utils.ts`). **Narrow exceptions:** micro inline flex inside one control; app chrome;
  `BalancedGrid`, `llm-card-grid`, `PageLayout` outer shell; shadcn internals; third-party layouts.
  **CSS overflow:** `overflow-y: auto|scroll|hidden` forces `overflow-x: visible` to compute as `auto`—cannot combine vertical scroll with horizontal bleed; prefer padding-based icon alignment over negative margins inside scroll containers.
- Client primary nav is shadcn `NavigationMenu` (`components/NavMenu/NavMenu.tsx`); menu structure in `apps/client/src/lib/nav-menu.config.ts` (`viewport={false}`; Tailwind `hidden md:flex` only—no `display` on CSS-module wrappers). Desktop megamenus are **click-only** (Radix hover suppressed on triggers)—never open on hover. Registry nav item label is **Packages** (not Libraries). **SPA:** routes in `src/routes/` wired in `src/router.tsx`; tsconfig aliases (`components/*`, `lib/*`, …)—not `@/*`. Vault routes use `vaultSessionLoader` + `VaultLayout`; `handle: { title, fullBleed? }` for `AppLayout`. TanStack Query in `src/queries/`; do not pass `initialData: []`. **`/registry` (Packages):** npmx-style `PackageCard` list; live `?q=` URL sync (`use-debounce`); Pinned|Search tabs (Pinned default; `/registry/pinned` redirects; no separate nav Pinned item); shared cards for pinned vs npm search; clear search on tab change; say “packages” not “libraries”; sort headers Title / Last Publish / Downloads with 3-state asc→desc→off (off returns relevance order). Package TypeScript status is three-way (native `typescript.svg` / DefinitelyTyped `typescript-declaration.svg` / none for JS-only)—show on package detail always; on list cards only in the Pinned tab (never Search). Package detail README uses Shiki via `readme-renderer`. **`/registry/repos` (Repositories):** same list/detail/pins pattern against GitHub (`PackageCard variant="repo"`; columns Title / Updated / Stars); separate pins at `~/.llaab/pinned-repositories.json` via `/api/registry/repo-pins`. Both registry list pages share a toolbar above the tabs (`forms/RegistryAddPinForm`): Add New Registry + Search cards in `packages/ui` Grid `Row`/`Col` `md={6}`; unified add form detects npm (`npmjs.com` / `npmjs.org` / `npmx.dev/package/{name}`) vs GitHub URL and pins; Search card always visible; tab label is **Search results** (not Search); when Pinned is active and pinned count `< MIN_PINNED` (10), typing in search auto-switches to Search results (pinned filtering still always applies); Search card title uses simple-icons npm / GitHub prefix (input keeps Lucide search slot). `PackageCard` title column: constrain via `titleBlock` `max-width: 768px` (not padding on the flex column—keeps header alignment). **Detail pages** (`/registry/package/:name`, `/registry/repos/:owner/:repo`): full-width; H1 prefixed with npm/GitHub simple-icons; back via `SecondaryActionBar` + `useSecondaryBackAction` as fixed `Link` routes to that registry type’s list (not `history.back()`); aside **340px** (`20px` right padding); sticky `top: 0` (not negative margin-top); keep package/repo sidebars aligned—Version then Last updated (date only); external links Repository / Package (optional) / Homepage (optional)—pinned labels are white+underlined internal `Link`s that update live on pin toggle; Knowledge Resource below Tags; repo counts Stars → Open Issues (no Watchers/Forks) plus optional Downloads from linked npm; package sidebar may show optional Stars / Open Issues from linked GitHub; lazy secondary fetches inside components for cross-enrichment, install size/vulns, and Socket scores (don’t block primary load); Socket gauges use local UI (`SOCKET_API_TOKEN`, packages scope—`SOCKET_API_TOKEN_SECRET` not needed); color bands ≥80 green / 50–79 warning / <50 danger; no socket.dev link in Package sidebar (scores row only); download WoW trend from npm public API (not Socket)—`space-between` row, colored arrow, dim grey percent; no duplicate GitHub URL in the main pane. Registry pins are operational bookmarks that project to vault `ResourceNode`s—see `docs/process/REGISTRY_RESOURCE_PROJECTIONS.md`.
- **Env / client / ports:** Monorepo `.env` at repo root; Vite `envDir` points there. Terminal WebSocket at `/terminal/ws` (moved off `/terminal` so hard refresh does not hit the upgrade handler). `LLAAB_API_URL` proxies `/api` and `/terminal/ws` only (not in the browser bundle); do not widen Vite `envPrefix`. **`PORT`** is the Vite dev port convention—keep `PORT` (not `LLAAB_PORT`). Auth: `LLAAB_API_KEY` (`X-API-Key` for API writes); optional `LLAAB_PASSWORD` (browser session for app writes); optional `VAULT_PASSWORD` (vault UI only—unset = open `/vault`). Optional `SOCKET_API_TOKEN` (Socket.dev org token, packages scope) enables registry Socket score gauges—`SOCKET_API_TOKEN_SECRET` not required for that API. Dead vars removed: `OPENAI_API_KEY`, `LL_STATS_API_KEY`. Local: client **5050**, server **8888**, icons **5001**/**5199**. `com.llaab.client` launchd runs `vite dev` (HMR), not `vite preview`. **Managed crontab** must call `scripts/macos/llaab-cron-run.sh` (sources `.env`, POSTs with `X-API-Key` via temp header file)—bare `curl` 401s when `LLAAB_API_KEY` is set; repair outdated lines via `/crons` Repair (do not rewrite crontab on every GET list).
- **Cloud model catalog + consolidation:** `configs/cloud-model-catalog.json` (gitignored; generate on demand if missing) cache-first via `packages/llm/src/cloud-model-catalog.ts`; optional `GET /models` metadata refresh (no chat tokens). `/llm` badges: Installed / Cloud / Catalog / On request. Single-pass `consolidate` LLM task (default `?mode=single-26b`); `consolidate-audit` removed. Quality scoring in `packages/schemas/src/consolidation-quality.ts` applies theme checks only when ≥2 theme-matching candidates; API returns `qualityValidation`; transcript UI shows score on the Canonical Ideas bar. **`extract`** and **`consolidate`** routed to OpenCode **`glm-5.2`**; terminal **`chat.ask`** uses the **`reason`** task → Ollama **`gemma4:26b-a4b-it-qat`** (`local-strong`) in `configs/llm-routing.json`.
- **lean-ctx (not graphify):** graphify is removed—do not invoke graphify tools/rules. Never copy lean-ctx tool-output footers into source/CSS (`--- lean-ctx: … ---`, `--- Cross-Source Hints ---` break Vite/oxc/PostCSS). Require lean-ctx **≥ 3.9.5** (redirect markers stay out of temp files). Lock `~/.config/lean-ctx/config.toml`: `savings_footer=never`, `bypass_hints=off`, `recovery_hints=off`, `[code_health] inject_context=false`. Repo `.lean-ctx/overlays.json` should ignore `knowledge/` and package `dist` outputs so they do not inflate context. Repo safety nets: `.cursor/hooks.json` `afterFileEdit` + `scripts/strip-lean-ctx-markers.py` (also in lint-staged).

<!-- lean-ctx -->

## lean-ctx

lean-ctx is active — the MCP tools replace native equivalents.
Full rules: LEAN-CTX.md (open on demand — do not auto-load).
<!-- /lean-ctx -->
