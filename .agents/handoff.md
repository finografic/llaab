# llaab — Handoff

> **How to maintain this file**
> Update after sessions that change architecture, add/remove features, resolve open questions, or shift priorities — not every session.
> — Update only the sections that changed. Keep the total under 150 lines.
> — Write in present tense. No code snippets — describe what exists, not how it works.
> — `.agents/memory.md` = session work log. `.agents/handoff.md` = project state snapshot. Never duplicate between the two.

---

## Project

`llaab` — Learning Loop & Agent Automation Base. Turborepo + pnpm monorepo. Two-process
architecture: `apps/server` (Hono + Bun, business logic) + `apps/client` (Vite + React Router SPA, UI).
Core pipeline: ingest YouTube → transcript → extracted ideas → canonical ideas → one-step
`Create Wiki(s)` (internal discover/compile/link/auto-promote) → promoted `knowledge/wikis/` pages,
with vault drafts and RunNode traces retained as provenance only.
Executable/generated skills are future work, not current ingest output.

## Architecture

Dependency chain (one-directional):
`@llaab/schemas` → `@llaab/core` → `@llaab/ingestion` → `@llaab/skills` → `@llaab/cli`
`@llaab/control` sits beside the execution flow — called from ingestion for governed LLM extraction.
`@llaab/schemas` + `@llaab/core` → `@llaab/client` (UI only, no skill deps)
`@llaab/schemas` + `@llaab/core` + `@llaab/skills` + `@llaab/llm` → `@llaab/server` (owns all business logic)

| Package     | Role                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `schemas`   | Zod schemas — 9 node types, ubiquitous language                                                                                |
| `core`      | Vault file I/O — `createNode`, `writeNode`, `readNode`, `listNodes`, `autoTag`                                                 |
| `control`   | Execution governance — `execute()`, retry/reject, decision traces                                                              |
| `ingestion` | Fetch → clean → structure → store pipeline; extraction is a separate exported function                                         |
| `icons`     | Workspace icon registry package — runs `icons-server` + `lucide-manager` (v0.12.8), exports app icons via `icons.generated.ts` |
| `llm`       | Task router + providers/executors — Ollama, Anthropic, OpenCode registration; `routeLlm`, `streamLlm`, capabilities, 24h cache |
| `skills`    | Composed workflows — `captureIdea`, `ingestYouTube`, `runSkill`                                                                |
| `cli`       | Binary entry point (`lab`) — citty commands: ingest, vault, agent, mcp, doctor, adapters, route                                |
| `client`    | Vite 8 + React 19 + React Router v7 — pure SPA UI, calls server via `src/lib/api.ts` (Hono typed RPC)                          |
| `server`    | Hono + Bun — REST API on port 8888, owns all non-UI logic                                                                      |
| `vault/`    | Data directory — markdown files organized by node type (not a package)                                                         |

## Stack

- Runtime: Node.js 24.16.0, pnpm 10.32.1, Bun 1.2.2
- Build: Turborepo 2.x, TypeScript 7.0.2
- Validation: Zod 4.x
- Tests: Vitest 4.x
- Icons: `@finografic/icons` + `@finografic/lucide-manager` via `@llaab/icons`
- Server: Hono 4.x, http-status-codes, @hono/zod-validator
- Client: Vite 8, React 19, React Router v7, React Hook Form 7.x, `@pierre/trees` (git-status file tree)
- Registry: `marked` v18 + `shiki` v4 + `sanitize-html` on the server for readme rendering (`apps/server/src/lib/readme-renderer.ts`); npm types in `packages/schemas/src/npm-registry.ts`; GitHub registry types in `packages/schemas/src/github-registry.ts`
- CSS: Tailwind CSS 4, shadcn/ui, app-local semantic CSS variables
- Linting: oxlint + oxfmt (`@finografic/oxc-config`); Prettier for markdown and legacy formats where needed
- Hooks: husky + lint-staged (pre-commit: lint + format + typecheck)
- Commits: commitlint

## Apps

### `@llaab/client` — Vite 8 + React Router SPA (port 5050)

Pure UI. All data calls go to `@llaab/server` via `src/lib/api.ts` (Hono typed RPC client).
Vite dev proxy forwards `/api/*` and `/terminal` → `LLAAB_API_URL` (default `http://localhost:8888`).

Auth: optional `X-API-Key` vs `LLAAB_API_KEY` env. No key set = dev mode, auth skipped.
Client styling: Tailwind v4 + shadcn/ui. shadcn components live in `packages/ui/src/components/`
(imported via `@llaab/ui/components/<name>`); a parallel set of app-local copies with local import
paths lives in `src/components/ui/` and is what all current React code imports via `components/ui/`.
The old PandaCSS + linked design-system stack has been removed from the client.
Vault pages fetch via TanStack Query hooks + Hono RPC (`/api/vault/*`); optional vault login when
`VAULT_PASSWORD` is set (unset = open local access).

Layout hierarchy: `index.html` + `main.tsx` mount a single React tree. `AppLayout` wraps a sticky
header + `SecondaryActionBar` (header of one resizable right-hand `AppSidebarLayout` slot) + main +
footer. `AppHeader` hosts `NavMenu` (brand link + shadcn megamenus + mobile sheet) plus navigation
shortcuts (ingest, transcripts, LLM, inbox, icons). `SecondaryActionBar` holds global contextual
actions — Clean Vault (dialog), Vault Changes, Activity Monitor (renamed from "Run Monitor" —
it's not ingest-specific anymore) — that share the single sidebar slot: `AppLayout` owns
`activePanel: 'runs' | 'vaultGit' | null` as the one source of truth for which panel renders
(mutually exclusive), syncing it to the resizable panel imperatively via `usePanelRef()`.
Per-route leading actions (e.g. registry detail back) register via
`useSecondaryBackAction` / `useSecondaryLeadingAction` (`SecondaryActionBarContext`) and clear on
unmount.
`RunMonitor` keeps its own `RunMonitorProvider` (zustand) for selected/dismissed run state only —
not panel open/closed, which `AppLayout` now owns. Full pattern, icon-button tiers, and badge
conventions: `apps/client/src/layouts/AGENTS.md`. New rule for any process with a live-status UI:
`.github/instructions/project/process-state-architecture.instructions.md` — status must be derived
from durable, shared query state (`useRunMonitor`), never a mutation's own `isPending`/local
component state, since the component can remount (e.g. switching transcripts) and lose it. Audit
of remaining non-compliant spots: `docs/todo/TODO_PROCESS_STATE_AUDIT.md`.
Both the ingest form (`IngestPipeline`) and Run Monitor render the same `RunPipelineCard`
(`apps/client/src/components/RunPipelineCard/`) — grey collapsible RUN shell, chain-of-thought
transcript/extraction steps (blue active / green complete / orange warning). A deduped/reused
transcript ("Transcript already saved") is not a failure and maps to green/complete, not orange —
only a genuine fetch/extraction failure maps to warning. Monitor-only activity log and
`ExtractionModelCard` metrics render in the card body.
Canonical-idea consolidation now runs through `runSkill('consolidate-canonical-ideas', ...)` so it
persists a `RunNode` like any other skill — visible in Activity Monitor, survives navigation away
from the transcript page. Re-consolidating a transcript that already has a committed canonical-idea
set is a **conflict** (never an additive merge): the new set is created on disk but
`canonical_coverage` is left pointing at the existing set until resolved. `CanonicalIdeaConflictWatcher`
(mounted once in `AppLayout`) detects unresolved conflicts purely from durable run + transcript +
canonical-idea data (no dedicated detection endpoint) and shows a global replace/keep-existing
dialog regardless of route. The always-visible "Clean" button on the transcript page
(`POST /transcripts/:id/canonical-ideas/clean`) is the manual-correction tool for artifacts the
automatic flow can't reach (orphaned files from manual deletes, or a conflict from before this
flow existed) — deletes every canonical-idea file + consolidate run tied to that transcript and
clears its coverage.
Terminal (`/terminal`) is a typed command-bus UI, not raw shell passthrough. It supports `ai.run`,
`agent.run`, `cron.run`, `fs.read`, `fs.list`, and session-gated `shell.exec`; command references
and the left action rail paste commands into the input and focus it, but never auto-run. Command
execution persists durable command `RunNode`s, and live process status belongs in the global
Activity Monitor sidebar, not terminal-local state.
Crons (`/crons`) are one-shot recipes plus external trigger snippets, not an internal scheduler.
The first recipe, `check-transcripts-consolidation`, scans transcripts with extracted ideas and no
canonical set, runs missing consolidation via the shared consolidation helper, and creates durable
cron/consolidation runs. External `cron`, `launchd`, GitHub Actions, Vercel Cron, or another
user-owned scheduler owns timing. The page leads with a collapsed `Cron syntax` legend
(`Collapsible`, closed by default) and a collapsed `Adding a Cron Recipe` walkthrough; each recipe
card's command + Run Now control is `CronCommandReference`
(`apps/client/src/components/CronCommandReference/`) so other vault pages can surface a specific
recipe's command/run button without duplicating the mutation wiring. `docs/todo/DONE_CRONS_PAGE.md`
tracks this as complete. Recipe cards use the icon-prefixed-title pattern (`IconHeading`,
`apps/client/src/components/IconHeading/`) — a generic `inline-flex` wrapper sizing its icon in
`em` so the same component works in card titles, sidebar sections, or page titles regardless of
font size; color/weight always come from the surrounding element, not the wrapper. Risk badges
are color-coded via the existing `--success`/`--info`/`--warning` semantic tokens (low/medium/high).
Each recipe also has a persisted `enabled` boolean — a kill-switch, not a "currently scheduled"
indicator (LLAAB still can't see external scheduler state) — stored in `configs/cron-recipes.json`
and toggled via `PATCH /api/crons/:id`; `runCronRecipe` checks it before doing any work, so Run Now,
`cron.run`, and external triggers are all blocked the same way while disabled. `/crons` shows this
as an active/disabled toggle (green pause / grey play) left of Run Now, not a read-only badge.
Cron run history is runtime state, not committed configuration: `configs/cron-history.json` is ignored/untracked and is recreated automatically on the next cron run. Durable recipe definitions remain in `configs/cron-recipes.json` and stay committed.
`VaultGitPanel` (`apps/client/src/components/VaultGitPanel/`) shows `git status` from the nested
`vault/.git` repo
via `@pierre/trees`'s `FileTree` (themed via `constants/pierre-trees-theme.ts` CSS custom-property
overrides), grouped by node type, with an auto-generated commit message
(`chore(vault): commit N files` + per-type bullet breakdown), a Commit button, and a Reset button
(discards all uncommitted nested-vault changes — `git checkout HEAD -- .` + `git clean -fd -- .` —
behind a confirm dialog). Server-side git operations (`apps/server/src/routes/vault/vault-git.routes.ts`)
shell out to `git` with `cwd` set to `VAULT_ROOT`, so parent source commits stay free of vault data
noise. The git-status query refetches after _any_ mutation in the app succeeds (subscribes to the
TanStack `MutationCache`), not just a few manually-wired ones — nearly every mutation here can touch
`vault/` files, so this stays correct without per-mutation wiring.
Inner pages use `PageLayout` (hero / optional aside / main zones) and `PageHero`. `src/router.tsx`
lazy-loads route components so the initial SPA chunk stays smaller; route handles set
title/full-bleed page chrome. Navigation structure: `lib/nav-menu.config.ts`; design spec:
`docs/NAV_MENU_DESIGN.md`. Home dashboard uses `utils/balanced-grid.utils.ts` to avoid orphan cards
in multi-column grids.

CSS entry points: `packages/ui/src/styles/globals.css` owns all framework imports (Tailwind,
`tw-animate-css`, `shadcn/tailwind.css`, Roboto), the shadcn stone token `:root`/`.dark` blocks,
and the `@theme inline` + `@custom-variant dark` directives. `apps/client/src/styles/app.css`
imports `forms.css` only, then adds app-specific semantic tokens (`--bg`, `--surface`, `--text`,
`--accent`, `--space-*`, `--font-mono`, etc.), a `rem`-based type scale (`--text-2xs` 9px through
`--text-4xl` 36px — all font sizes in the client use these so `html { font-size }` controls the
whole UI), and overrides the shadcn tokens with LLAAB's warm amber dark palette in `:root {}`.
`main.tsx` imports globals then `app.css`. `forms.css` retains only native element resets for
`input`, `textarea`, and `select` — all hand-rolled component classes were removed.
Dark mode is always active via `class="dark"` on `<html>` (hardcoded — LLAAB is dark-only).
Installed shadcn components in `packages/ui/src/components/` include `navigation-menu`, `sheet`,
`accordion`, `button`, `badge`, `breadcrumb`, `scroll-area`, `table`, `tooltip`.
Homepage (`routes/root.tsx`) callout cards: Ingest, Vault, Runs, Models, Hermes / MCP, Icons
(`BalancedGrid`). Ingest and Icons cards reuse the same Lucide icons as the app-header shortcuts.
`/icons` redirects to `/dev/icons` (Lucide picker / registry).

| Route                          | Description                                                                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                            | Home dashboard — callout cards for core operator surfaces                                                                                             |
| `/ingest`                      | URL form with card-wide drag/drop; two-phase ingest; `RunPipelineCard` progress + grouped `RunsTable` (collapsed by subject, sortable published date) |
| `/terminal`                    | Typed command bus UI — actions rail, command injection, structured/raw/JSON output, durable command runs                                              |
| `/crons`                       | One-shot cron recipe dashboard — Run Now, external trigger snippets, recent cron runs                                                                 |
| `/llm`                         | LLM routing dashboard: provider/model selects, installed dots, Ollama + LM Studio models                                                              |
| `/hermes`                      | Hermes / MCP dashboard: Discord gateway notes, scoped vault tools, guardrails, cost-routing follow-up                                                 |
| `/icons`                       | Redirect to `/dev/icons` (embedded Lucide picker)                                                                                                     |
| `/vault`                       | Gated file-tree browser — recursive tree, `@pierre/diffs` file viewer, optional `?view=diff` working-tree diff per selected file                      |
| `/vault/inbox`                 | Hermes capture triage list — grouped by route kind, review/select actions, missing-thumbnail filter                                                   |
| `/vault/inbox/:id`             | Single capture detail                                                                                                                                 |
| `/vault/transcripts/:id`       | Detail: source metadata, ideas, one-step Create Wiki(s), and Re-extract                                                                               |
| `/vault/wiki-drafts/:id`       | Diagnostic/recovery audit draft (not required for creation)                                                                                           |
| `/vault/wiki-candidates`       | Diagnostic discovery queue (not the normal Create Wiki(s) path)                                                                                       |
| `/vault/wiki-candidates/:id`   | Diagnostic candidate evidence / compile into a recovery draft                                                                                         |
| `/vault/nodes`                 | PageLayout + NodesFileList; nodes by type (idea/resource/prompt/skill/instruction)                                                                    |
| `/vault/nodes/:id`             | Detail: breadcrumb, title/type/status/date, tags, body, type-specific fields                                                                          |
| `/vault/sources/:id`           | Detail: kind/follow/url/profiles, add linked GitHub profile, transcripts table with idea count                                                        |
| `/vault/runs/:id`              | Detail: summary grid, stages table, decisions list, error block                                                                                       |
| `/knowledge/wikis`             | Browse promoted source-backed wiki pages from `knowledge/wikis/`, with confirmed wiki deletion                                                        |
| `/knowledge/wikis/:id`         | Rendered promoted page with evidence metrics, unpublish/delete, and section regenerate/delete                                                         |
| `/registry`                    | Packages list — shared Add/Search toolbar; Pinned \| Search results tabs; `PackageCard` list (Title / Last Publish / Downloads)                       |
| `/registry/package/:name`      | Package detail — readme + aligned metadata aside; SecondaryActionBar back to `/registry`                                                              |
| `/registry/pinned`             | Redirects into `/registry` Pinned tab                                                                                                                 |
| `/registry/repos`              | Repositories list — same toolbar/tabs pattern against GitHub; `PackageCard variant="repo"` (Title / Updated / Stars)                                  |
| `/registry/repos/:owner/:repo` | Repo detail — readme + aligned metadata aside; SecondaryActionBar back to `/registry/repos`                                                           |

**Registry UI (Packages + Repositories):** Both list pages share `forms/RegistryAddPinForm` —
Add New Registry (paste/drop URL → pin) + Search card always visible. Add form accepts
`npmjs.com` / `npmjs.org` / `npmx.dev` package URLs and `github.com` repo URLs (plus bare
`@scope/name`, package name, or `owner/repo`). Search auto-switches from Pinned → Search results
when pinned count `< MIN_PINNED` (10). Detail pages use `PageList width="full"` (no 1200px cap);
main column flexes, aside fixed 320px. Detail sidebars put external links first and Knowledge
Resource last. Package detail orders npmx.dev/npmjs.com, repo/homepage, version/downloads,
last updated/license, deps, tags, maintainers. Repo detail orders repo/homepage, optional
release/tag version, counts, last updated/license, languages, tags, linked maintainer. Nav label
is **Packages**. Megamenus are click-only. Types: `packages/schemas/src/npm-registry.ts`,
`github-registry.ts`. Client queries:
`apps/client/src/queries/registry/`.

**Registry pins (Hermes-relevant):** Pins are **not** vault nodes — JSON files under `~/.llaab/`.

| Kind       | Store file (override env)                                    | List / pin / unpin API                                                            | Body / key                    |
| ---------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------- | ----------------------------- |
| Package    | `~/.llaab/pinned-packages.json` (`LLAAB_PACKAGE_PINS_PATH`)  | `GET/POST /api/registry/pins`, `DELETE /api/registry/pins/:name`                  | `{ name }` — npm package name |
| Repository | `~/.llaab/pinned-repositories.json` (`LLAAB_REPO_PINS_PATH`) | `GET/POST /api/registry/repo-pins`, `DELETE /api/registry/repo-pins/:owner/:repo` | `{ fullName }` — `owner/repo` |

Both `POST`s snapshot live meta at pin time (`PackageMetaResponse` / `RepoMetaResponse`) and return
**409** when already pinned (UI and Hermes treat that as idempotent success for packages). Pin
requires `X-API-Key` when `LLAAB_API_KEY` is set (same as other writes).
Registry pins are projected into `ResourceNode`s so packages/repositories become first-class vault knowledge resources rather than only UI bookmarks; architecture reference: `docs/process/REGISTRY_RESOURCE_PROJECTIONS.md`.

`AppSidebarLayout` (`packages/ui/src/components/app-sidebar-right-layout.tsx`) supports both
percentage and absolute-unit (`px`/`rem`) sidebar sizing — `isPercentOrBare()` only computes
main-panel percentage complements when `minWidth`/`maxWidth`/`defaultWidth` are all percent/bare
numbers; absolute-unit sidebars give the main panel `minSize="1%"` and `undefined` default/max so
it doesn't collapse. `app-sidebar-dual-layout.tsx` (`packages/ui/src/components/app-sidebar-dual-layout.tsx`) wraps
`AppSidebarLayout` with a `PanelLeftIcon` collapse/expand toggle (`usePanelRef`) alongside the
manual resize handle; `TranscriptsSplitView` uses it with a 600px-minimum sidebar containing the
`TranscriptsSplitView` uses it with a 600px-minimum sidebar containing the transcript list.
`/vault/transcripts` index auto-navigates to the latest transcript by `created_at`. Sidebar list
items (`TranscriptsSidebar.tsx`) use the 12-col grid (`Col`/`Row`, `flex-wrap` always on) so two
column pairs sit on one visual line each: title (left) + author (right, `space-between`) on row
one, then numeric date (`fmtListDateNumeric`, `DD-MM-YYYY`, left) + `ExtractionModelCard` (right)
on row two — the model card's own model/provider chips and token/latency stats still wrap onto a
further line at narrow widths, unchanged. A `Combobox`-based (`components/ui/combobox.tsx`, Base
UI primitive) multi-select `AuthorFilter` sits below the search input and OR-filters the list by
author; its selection persists via `usePersistedUiState` (see below) under the
`'transcripts.authorFilter'` key.

**Persisted UI state:** `apps/server/src/routes/ui-state/` is a generic key/value store for
UI-only settings that should survive reload/restart but aren't vault content — a project-local,
XDG-config-style JSON file (`configs/ui-state.json`), not a database. `GET/PUT /api/ui-state/:key`
covers every consumer; adding a new persisted setting never needs a new route. Client side:
`usePersistedUiState<T>(key, defaultValue)` (`apps/client/src/queries/ui-state/`) wraps it in a
TanStack Query hook. Full pattern + "how to add a new setting": `apps/server/src/routes/ui-state/AGENTS.md`.
Each sidebar list item can show `ExtractionModelCard`
(`apps/client/src/components/ExtractionModelCard/`) variants: `compact` for a latency-only badge,
`compact-bar` for inline model/provider pills plus right-aligned token/latency metrics (`showModel` /
`showTotalTokens` toggles), and `full` for the transcript detail card. Consolidate on transcript
detail shows a heartbeat elapsed timer while pending. `ExtractionModelCard` wraps `ai-latency-meter`/`ai-token-viewer`
(`packages/ui/src/components/`, ported from tryelements.dev) — cost display is omitted because
local models have no pricing data.

A 12-column flexbox grid (`Container`/`Row`/`Col`, Bootstrap-style, Tailwind-matching breakpoints,
no Context/runtime JS) lives at `packages/ui/src/components/grid/`, imported via `components/ui/grid`;
CSS auto-included via `packages/ui/src/styles/globals.css`. **Agent rule:** use grid for **all**
structural layout blocks (page, card, row, section splits) — not Tailwind `flex`/`grid`/`grid-cols-*`
for column structure; narrow exceptions in `docs/components/grid.md` and `.cursor/rules/grid-layout.mdc`.
Migration done 2026-07-11 (`docs/todo/DONE_GRID_LAYOUT_MIGRATION.md`).

### `@llaab/server` — Hono + Bun (port 8888)

Auth: optional `X-API-Key` vs `LLAAB_API_KEY` env. No key set = dev mode, auth skipped.
Each route group: `*.schema.ts` (Zod), `*.routes.ts` (`{ path, handler }` exports), `index.ts` (wiring).
Vault HTTP routes are split by domain under `apps/server/src/routes/vault/` (nodes, transcripts,
sources, runs, etc.) with `vault/index.ts` chaining only.
Long-running ingest, extract, and canonical consolidation routes explicitly disable Bun's
per-request idle timeout so the client does not receive false network failures while the server
continues processing.

| Route                                                              | Description                                                                                                                                                                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/ingest/youtube`                                         | `ingestYouTube` skill — `{ url, title?, tags?, skipExtraction? }`                                                                                                                                             |
| `GET /api/crons`                                                   | Lists one-shot cron recipe metadata and external trigger examples                                                                                                                                             |
| `POST /api/crons/:id/run`                                          | Runs a cron recipe once, creates a durable cron `RunNode`, and never schedules future work internally                                                                                                         |
| `GET /api/vault/nodes`                                             | `listNodes()` — `?type`, `?status`, `?tags`, `?search`, `?limit`                                                                                                                                              |
| `GET /api/vault/nodes/:id`                                         | Single node by id                                                                                                                                                                                             |
| `PATCH /api/vault/sources/:id/profiles`                            | Updates linked source profiles (GitHub first)                                                                                                                                                                 |
| `GET /api/vault/transcripts/:id/ideas`                             | Returns `{ ideas: {id, title}[] }` from transcript's `extracted_idea_ids`                                                                                                                                     |
| `POST /api/vault/transcripts/:id/extract`                          | Run LLM extraction on a saved transcript; returns `{ success, ideaIds, ideas }`                                                                                                                               |
| `POST /api/vault/transcripts/:id/consolidate`                      | Single-pass canonical idea generation with quality validation from extracted candidate ideas; `RunNode`-backed (`runSkill`); returns `conflict: true` instead of overwriting coverage if a set already exists |
| `POST /api/vault/transcripts/:id/wiki-drafts`                      | One-step Create Wiki(s): discover → compile → link → auto-promote; returns promoted pages and branch outcomes                                                                                                 |
| `GET/PATCH /api/vault/wiki-drafts/:id`                             | Diagnostic draft read/edit for recovery                                                                                                                                                                       |
| `POST /api/vault/wiki-drafts/:id/promote`                          | Recovery promotion of a draft into `knowledge/wikis/` without Git mutation                                                                                                                                    |
| `POST /api/vault/wiki-drafts/:id/reject`                           | Rejects a draft while keeping vault provenance                                                                                                                                                                |
| `POST /api/vault/wiki-drafts/:id/regenerate`                       | Recompiles from the same selected evidence and supersedes the previous draft                                                                                                                                  |
| `POST /api/vault/wiki-candidates/discover`                         | Diagnostic one-shot discovery; creates vault candidates only                                                                                                                                                  |
| `GET/POST /api/vault/wiki-candidates/:id/compile`                  | Diagnostic compile of one candidate into a recovery draft                                                                                                                                                     |
| `POST /api/vault/wiki-research`                                    | Records explicitly approved manual research evidence for a wiki/draft                                                                                                                                         |
| `GET /api/knowledge/wikis`, `/:id`                                 | Lists wikis and reads promoted Markdown plus rendered section HTML                                                                                                                                            |
| `POST /api/knowledge/wikis/:id/demote`                             | Unpublishes a promoted wiki while retaining vault draft lineage                                                                                                                                               |
| `DELETE /api/knowledge/wikis/:id`                                  | Deletes one promoted wiki file and scrubs inbound typed links from remaining promoted wiki files                                                                                                              |
| `POST/DELETE /api/knowledge/wikis/:id/sections/:sectionId/*`       | Regenerates one source-backed section or removes one section while retaining at least one and incrementing the wiki revision                                                                                  |
| `GET/POST /api/knowledge/wikis/graph/export`                       | Derives the wiki graph from promoted Markdown and optionally exports it under `knowledge/knowledge-graphs/`                                                                                                   |
| `POST /api/vault/transcripts/:id/canonical-ideas/resolve-conflict` | Resolves canonical idea conflicts with keep `existing` or `incoming`; deletes the losing set's files, writes coverage if incoming wins                                                                        |
| `POST /api/vault/transcripts/:id/canonical-ideas/clean`            | Deletes every canonical-idea file + consolidate run for that transcript (incl. orphans) and clears coverage                                                                                                   |
| `GET /api/runs`, `/:id`                                            | Run list + detail with full stage/decision trace                                                                                                                                                              |
| `GET /api/runs/monitor`                                            | App-shell run monitor DTO: active/recent runs, steps, links, compact summaries                                                                                                                                |
| `POST /api/runs/dismiss-all`                                       | Sets `monitor_dismissed_at` on all inactive, non-dismissed runs                                                                                                                                               |
| `GET /api/vault/git/status`                                        | Nested `vault/.git` status, categorized by node type, with a generated commit message                                                                                                                         |
| `GET /api/vault/git/diff`                                          | Nested vault `git diff -- <path>` patch text for `@pierre/diffs` viewer (`?path=`)                                                                                                                            |
| `POST /api/vault/git/commit`                                       | Nested vault `git add --all` + `git commit` using the generated commit message                                                                                                                                |
| `POST /api/vault/git/reset`                                        | Nested vault `git checkout HEAD -- .` + `git clean -fd -- .` — discards all uncommitted vault changes                                                                                                         |
| `POST /api/llm/complete`                                           | Routed LLM completion — `{ task, prompt, system?, model?, maxTokens? }`                                                                                                                                       |
| `POST /api/llm/stream`                                             | SSE streaming LLM                                                                                                                                                                                             |
| `GET /api/llm/models`                                              | Lists installed Ollama models                                                                                                                                                                                 |
| `GET /api/llm/status`                                              | Task routing config + installed models cross-referenced                                                                                                                                                       |
| `GET /api/llm/capabilities`                                        | Provider capability metadata + availability                                                                                                                                                                   |
| `POST /api/agent/run`                                              | One-shot agent processor; optional `{ nodeId?, force? }`                                                                                                                                                      |
| `GET /api/agent/status`                                            | Last run metadata                                                                                                                                                                                             |
| `GET /api/registry/npm/search`                                     | Proxies npm registry search; `?q`, `?size`, `?from`                                                                                                                                                           |
| `GET /api/registry/npm/package/:name`                              | Packument proxy → `PackageDetailResponse` (meta + `readmeHtml` via `readme-renderer.ts` + deps/typesStatus/isEsm)                                                                                             |
| `GET /api/registry/pins`                                           | `PinnedPackage[]` from `~/.llaab/pinned-packages.json` (`LLAAB_PACKAGE_PINS_PATH`)                                                                                                                            |
| `POST /api/registry/pins`                                          | Pin package `{ name }` — snapshots meta; **409** if already pinned                                                                                                                                            |
| `DELETE /api/registry/pins/:name`                                  | Unpin package by name                                                                                                                                                                                         |
| `GET /api/registry/github/search`                                  | Proxies GitHub repo search; `?q`, `?size`, `?from`                                                                                                                                                            |
| `GET /api/registry/github/repo/:owner/:repo`                       | Repo detail DTO (meta + languages + optional `latestVersion` from latest release/tag + `readmeHtml`)                                                                                                          |
| `GET /api/registry/repo-pins`                                      | `PinnedRepository[]` from `~/.llaab/pinned-repositories.json` (`LLAAB_REPO_PINS_PATH`)                                                                                                                        |
| `POST /api/registry/repo-pins`                                     | Pin repo `{ fullName }` — snapshots meta; **409** if already pinned                                                                                                                                           |
| `DELETE /api/registry/repo-pins/:owner/:repo`                      | Unpin repository                                                                                                                                                                                              |

### `@llaab/icons` — Workspace icon registry package

Owns `icons.config.json`, `icons.generated.ts`, and the package export surface for generated icons.
Consumer imports use `@llaab/icons` rather than root files. The package runs as its own Turbo `dev`
task and starts three sidecars: `icons-server` (port 5001), `lucide-manager` Vite picker (port 5199),
and generated-export syncing. `scripts/start-icons-server.mjs` redirects `icons-server` into
`.icons-server-runtime/` so its config write does not overwrite `lucide-manager.config.json`.
`lucide-manager.config.json` controls picker port, branding (title + optional `img` as relative
file path auto-converted to data URL at startup), and iconsApi host/port.
`openOnStart: false` suppresses browser auto-open; `strictPort: true` prevents port bumping.

## Ingestion Pipeline

Two-phase split — transcript always saved first, extraction is best-effort:

1. `runIngestionPipeline` — fetches YouTube, parses/cleans transcript, saves `TranscriptNode` + `SourceNode`. No LLM call.
2. `extractKnowledgeFromTranscript(id, path, plainText)` — runs `llmExtractWithTrace`, updates transcript `summary`, writes `extracted_idea_ids`, creates `IdeaNode`s with `related: [transcriptId]`. Returns `{ ideaIds, ideas: [{id, title}] }`.

The ingest UI fires these as two sequential API calls so the user sees phase-by-phase feedback.
`skipExtraction: true` on the ingest endpoint makes step 1 return immediately (no LLM blocking).
The extraction boundary now includes a tiny local harness-prep stage using `@finografic/ai-harness`
before `control.execute(...)`. Current use is intentionally narrow: deterministic prep only, no
token-aware runtime harness yet.

`IngestForm` still processes one item at a time (one `transcriptPhase`/`extractionPhase` state
machine), but submitting/dropping a YouTube URL while another is `durableBusy` no longer blocks —
it pushes a `QueuedIngestItem` onto a local `queue` array instead (URL field button relabels to
"Add to Queue"; `IngestQueueList` shows what's waiting with a per-item Remove). Four effects drive
the chain once queue mode is active (the queue has been engaged at least once this session — set
by `queueModeActiveRef`, checked via `durableBusy`/`transcriptPhase`/`extractionPhase`): (1) a
failed extraction auto-retries up to `EXTRACTION_MAX_RETRIES` (1) and (2) a failed transcript
fetch auto-retries up to the separate, larger `TRANSCRIPT_FETCH_MAX_RETRIES` (3) — fetching from
YouTube directly is more prone to transient failures than a local extraction retry — each retry
delayed by the shared `QUEUE_GLOBAL_TIMEOUT_MS` (1000ms) throttle; outside queue mode, both
failure types still wait for their manual Retry button. The retry counter increments _inside_ the
`setTimeout` callback, not when scheduling it — incrementing eagerly would let effect (3) below
read the post-increment count in the same render and detect "exhausted" one retry early. (3) Once
either retry budget is exhausted and still failing, or extraction reaches a non-failure terminal
phase (`success`/`existing`/`extractable`), and there's already a next item queued, the form
resets itself without showing Keep/Discard (the click is literally skipped, not simulated). Failed
`ingest-youtube` runs delete their transient `RunNode` instead of persisting failed MD files. (4) A
separate effect then dequeues and starts the next item after the same throttle, so items never
fire back-to-back. The _last_ item in a batch is left showing the normal manual
Keep/Discard/Retry footer (or, for an exhausted transcript-fetch failure, just the inline retry —
there's no Discard for a failure with nothing to discard) — auto-advance only fires when something
is already waiting. `resetCurrentItem({ preserveDraft: true })` is the variant the auto-advance
path uses — it does **not** clear the URL/tag fields, since by the time it fires the user may
already be typing/dropping a later item into them. Retries always resubmit `currentItemRef`'s
tracked `{ url, tags }`, not the live form fields — those may already hold a draft for a
_different_, not-yet-started item.

## LLM Layer

Task routing (all env-configurable via `LLAAB_*_MODEL` vars):

| Task          | Tier         | Provider | Default model         |
| ------------- | ------------ | -------- | --------------------- |
| format        | local-small  | ollama   | gemma4:e4b-it-qat     |
| extract       | remote       | opencode | glm-5.2               |
| consolidate   | remote       | opencode | glm-5.2               |
| wiki-compile  | remote       | opencode | glm-5.2               |
| wiki-discover | remote       | opencode | glm-5.2               |
| code          | local-strong | ollama   | gpt-oss:20b           |
| reason        | local-strong | ollama   | gemma4:26b-a4b-it-qat |

Canonical consolidation uses extracted idea nodes only, not the full transcript body. It runs a
single pass through `routeLlm("consolidate", ...)`, validates quality deterministically (with
optional auto-retry), persists `CanonicalIdeaNode` files with `key_claims` / `coverage_notes`, and
writes `TranscriptNode.canonical_coverage` metadata (including `quality_score`) so the transcript
UI can show coverage and score after reload. Current routing sends `consolidate` through OpenCode
Go `glm-5.2`.

Wiki creation is one visible action (`Create Wiki(s)`): internal discover → compile → link →
auto-promote into `knowledge/wikis/`. Vault drafts remain audit/regeneration lineage; candidate and
draft UIs are diagnostic/recovery only. Compilation uses a bounded per-topic evidence packet, not
full-vault dumps. Promotion never runs Git. Research (`research-wiki`) stays approval-gated.
Unpublish demotes a page while preserving vault draft lineage. Detail:
`docs/todo/DONE_WIKI_TOPIC_DISCOVERY_PIPELINE.md` and `docs/process/WIKI_WORKFLOW.md`.

`getLlmStatus()` exported from `@llaab/llm` returns the live routing map (respects env overrides).
Ollama provider uses `chat` API (not `generate`) for proper system/user separation. LM Studio is
also available as `provider: "lmstudio"` via its OpenAI-compatible local server
(`LLAAB_LMSTUDIO_BASE_URL` or `http://localhost:1234/v1`); `/llm` shows provider-qualified model
options like `(Ollama) gemma...` and `(LM Studio) google/gemma-4-e4b`, and routing persists both
provider and model in `configs/llm-routing.json`.
Extraction prep is token-aware: long transcripts are chunked with overlap instead of blindly
truncated, and chunk outputs are reduced/deduped.

Capabilities are shared through `@llaab/core`. LLM providers, skill routes, typed commands, and
executor adapters declare/query capabilities. `OpenCode` is registered as an external executor
adapter but reports unavailable unless the `opencode` binary exists.

Phase 10 is complete: `shell.exec` exists in the typed command protocol and server command bus,
with a per-session enable/disable gate, per-command `--confirm` / `confirmed: true`, and an
allowlist (`git`, `pnpm`, `node`, `yt-dlp`, `opencode`). The Terminal Panel exposes
`shell.exec --enable-session --confirm`, confirmed allowlisted commands, and
`shell.exec --disable-session`.

## Schema / Types

9 node types in `packages/schemas/src/*.schema.ts`. All extend `BaseNode`. IDs are human-readable slugs.
`parseFrontmatter` (`packages/core/src/utils/parse-frontmatter.utils.ts`) now `JSON.parse`s
quoted scalar frontmatter values (not just strips outer quote chars) — without this, any node
updated via `updateNode` more than once in its lifetime (any skill that calls it 3+ times, e.g.
event logging + LLM trace + finish) compounded escaping on every read-modify-write cycle until a
string field like `input_summary` became unparseable garbage. Regression tests in
`parse-frontmatter.utils.test.ts`.

| Type             | Description                                                                             |
| ---------------- | --------------------------------------------------------------------------------------- |
| `TranscriptNode` | Ingested content; `source_url`, `source_type`, summary/length stats, canonical coverage |
| `IdeaNode`       | Captured thought; `origin` (manual/extracted/generated), optional `source_id`           |
| `SkillNode`      | Executable knowledge; inputs/outputs/tools, lineage                                     |
| `SourceNode`     | Person/channel/repo origin; `platforms`, linked `profiles`, `follow` flag               |
| `RunNode`        | Execution trace; `stages`, `decisions`, LLM trace, `produced_node_ids`                  |
| `WikiDraftNode`  | Reviewable wiki create/update/no-op/needs-review proposal stored in the vault           |

Promoted wiki pages are not vault nodes. They are validated Markdown files under `knowledge/wikis/`
with source refs, stable section markers, revision/hash checks, and typed wiki links. Derived graph
data is disposable and rebuilds from those promoted files. Promoted wiki deletion removes the wiki
Markdown file and rewrites remaining promoted wiki files to remove inbound typed links to the
deleted page; vault transcripts, canonical ideas, and historical drafts remain intact.

Run persistence compacts large duplicated text fields (`body`, `plainText`, `text`, `transcript`)
inside summaries and stage payloads. Existing June 13 ingest run files were migrated. Run deletion
uses produced-node reference checks so shared transcripts/sources and canonical-referenced ideas are
preserved unless no remaining graph reference exists. `POST /api/vault/runs/delete-preview` returns
nodes-to-delete/preserved/canonical-ideas-affected before a destructive single or batch delete; both
`DeleteRunAction` and `DeleteRunGroupAction` render this preview before confirming.

`RunNode.monitor_dismissed_at` (optional timestamp) marks a run as dismissed from the Run Monitor's
"Recent" list without deleting the run node/file. `POST /api/runs/:id/dismiss` sets it via
`updateNode`; `POST /api/runs/dismiss-all` dismisses every inactive non-dismissed run in one call.
`GET /api/runs/monitor` excludes runs with this field from `recent`. Per-run Dismiss and Recent-section
Dismiss all both update local `dismissedRunIds` zustand state and persist via the API.

`CanonicalIdeaNode` consolidation produces a per-candidate coverage map
(covered/omitted/missed) and a 0–100 quality score, both persisted on
`TranscriptNode.canonical_coverage`. Transcript detail surfaces this as a coverage summary plus a
"Possible missed ideas" / "Uncovered candidate ideas" panel, with source run model/provider/timestamp
per row and a "Promote to canonical" button (`POST /api/vault/transcripts/:id/canonical-ideas/promote`)
that turns a missed candidate idea into its own `confidence: "medium"` canonical idea and updates the
transcript's coverage record.

## Taxonomy

Tags use a single `d:` prefix. 8 domain tags: `d:llm`, `d:automation`, `d:ingest`, `d:schema`,
`d:infra`, `d:integration`, `d:ui`, `d:meta`. `autoTag(title, body)` in `@llaab/core` infers tags
via regex. All ingest runs apply `d:ingest` + `autoTag`. Source nodes carry no domain tags.

LLM-extracted content tags (`IdeaNode.tags`) are required (`z.array(z.string()).min(1)`) and the
extraction prompt's few-shot example deliberately uses an orthogonal domain (cooking) with an
anti-copying instruction — small local models otherwise anchor on the example's wording/tags for
in-domain (AI/LLM) input and either echo it verbatim or omit `tags`. `IngestForm` tag suggestions
blend `KNOWN_TAGS` with tags ranked by usage across existing vault nodes (`vaultTagsByUsage`).

## Client data fetching

`apps/client` reads/mutates vault data via TanStack Query hooks grouped by domain under
`src/queries/<domain>/` (`runs`, `transcripts`, `nodes`, `vault`) — each a barrel exporting
`QUERY_KEYS.<domain>` plus typed query/mutation hooks that call `api.*` (`lib/api`, the typed
Hono RPC client) directly. A single `QueryClientProvider` in `main.tsx` wraps the whole SPA
(shared `queryClient` singleton). Mutation hooks invalidate via `QUERY_KEYS` on success.
Docs: `docs/CLIENT_DATA_FETCHING.md`, `docs/server/HONO_RPC.md`. Migration writeup:
`docs/todo/DONE_CLIENT_VITE_MIGRATION.md`.

## Vite migration (2026-06-13) — notable changes

Astro removed; client is Vite 8 + React Router v7 SPA. All former Astro API routes and vault
auth live on `apps/server`. **Ports:** client **5050**, server **8888** (icons 5001/5199).
**Env:** `LLAAB_API_URL` (Vite proxy only), `LLAAB_API_KEY` (server), optional `VAULT_PASSWORD`
(unset = open vault). Client uses same-origin `/api/*` and proxied `/terminal` WebSocket — no
API keys in the browser bundle. `@llaab/core` / `@llaab/ingestion` removed from client deps.
Persistent launchd client defaults to Vite dev/HMR. Set `LLAAB_CLIENT_RUNTIME=preview` for staged
`vite build` + `vite preview` (`.persistent/builds/`).
Post-migration fixes: ingest `RunsTable` groups runs by subject with sortable YouTube publish date
(`extractRunPublishedAt` from `fetch:youtube` stage), collapsed child rows, and aligned metrics;
YAML `profiles` object-array parsing so all source nodes load for runs author links.

## Roadmap & Planning

Primary plan: `docs/todo/ROADMAP.md`. Near-term tasks: `docs/todo/NEXT_STEPS.md`.
Current orchestration plan: `docs/todo/DONE_ORCHESTRATION.md`.
Wiki generation is implemented; the completion record is `docs/todo/DONE_WIKI_GENERATION.md` and
the ongoing feature reference is `docs/process/WIKI_WORKFLOW.md`.
Hermes setup and follow-ups: `docs/todo/TODO_HERMES_LAYER.md`,
`docs/todo/DONE_HERMES_DROPBOX.md`, and `docs/todo/TODO_INBOX_VIEWS.md`. Vault/knowledge split plan:
`docs/todo/TODO_VAULT_KNOWLEDGE_SPLIT.md`; current shape is source/docs/`knowledge/` in the parent
repo and volatile working data in the nested `vault/.git` repo.
Playwright learning playground: `docs/todo/TODO_PLAYWRIGHT_PRACTICE.md`.
UI Refactor (all 3 phases) and horizontal nav menu migration are complete as of 2026-06-07. P0 is empty.
Orchestration phases 0–10 are complete. The Phase 6b addendum content is consolidated into
`DONE_ORCHESTRATION.md`; there is no separate addendum tracking file.
TODO/DONE doc conventions: `.github/instructions/documentation/todo-done-docs.instructions.md`.

## Agent context tooling

Repo graph hooks and generated context artifacts are no longer part of the default LLAAB agent
path. LeanCTX is installed through Homebrew with local agent integrations detected by its setup,
including Codex, VS Code/Cursor workspace MCP, Claude Code, OpenCode, Copilot CLI, and Hermes MCP
config. Treat this as a context-hygiene pilot: Hermes usage is registered but not validated for the
LLAAB inbox/runtime path, and raw reads/search remain the escape hatch while evaluating whether
LeanCTX actually reduces context noise.

## Hermes / MCP

Hermes is installed and connected to Discord as `lab` and Telegram as the LLAAB Inbox bot. Discord
remains the operator/command surface; Telegram owner DMs are the zero-friction inbox/dropbox. The
active provider/model seen in OpenCode usage is `glm-5.2` via OpenCode Go. The gateway is managed
by launchd through `scripts/macos/llaab-service.sh` as `com.llaab.hermes.gateway`; SwiftBar includes
Hermes Gateway start/stop/restart, Hermes Client, Hermes Agent, and Tail Gateway Log actions. A
foreground terminal running `hermes gateway run` is no longer required. Gateway lifecycle notices
are sent to the home channel: 🟡 shutting down and 🟢 online.

Hermes MCP access is intentionally scoped to the LLAAB repo/vault. The `llaab` MCP server runs the
built CLI with Node and exposes vault read helpers plus inbox write helpers. Telegram inbox writes
are deterministic and do not execute shell commands. Known routes: YouTube URL ingest, npm package
pinning (`npmjs.com` and `npmx.dev/package/*` → `vault_pin_package` → `POST /api/registry/pins`),
`npx`/`npmx`/`pnpm dlx` command candidates, `todo:` notes, GitHub repo links, `docs:` links/attachments,
`post:` links, generic links, images, attachments, and `code:` snippets/links/attachments. Obvious
JSX/TSX paste without a prefix also routes as a code snippet; JSX-like snippets normalize to `tsx`.

**Hermes → registry pins (current vs gap):** Package pins are wired end-to-end — inbox
`npm_package` → MCP/CLI `vault_pin_package` → `POST /api/registry/pins` with `{ name }` (409 =
already pinned). Repository pins exist on the **server/UI** (`POST /api/registry/repo-pins` with
`{ fullName: "owner/repo" }`, store `~/.llaab/pinned-repositories.json`, list at `/registry/repos`)
but Hermes inbox still treats `github_repo` as a **web-link IdeaNode capture** (`inbox:github`),
not a registry pin. Follow-up for Hermes repo pinning: add `vault_pin_repository` (mirror
`vault_pin_package` in MCP + `lab inbox` executor), map `github_repo` routes to that tool instead
of (or in addition to) idea capture, and treat 409 as idempotent success. Allowlist the new tool
in `~/.hermes/config.yaml` the same way as `vault_pin_package`.

Telegram inbox feedback uses Hermes reactions for quick processing state and short explicit final
receipts such as `✅ Ingested YouTube video: ...`, `✅ Saved docs link: ...`, or `✅ Saved code
snippet: ...`. Attachments win over embedded URLs so uploaded files are never lost; `docs:` captions
on Markdown attachments route as docs attachments. Distinct docs links are keyed by full URL path,
not just host. Remaining manual checks: unauthorized Telegram user rejection and Discord operator
console unchanged. Future inbox work is in `TODO_INBOX_VIEWS.md`: shared list/detail views,
fallback renderers, AI-assisted categorization, snippet extraction from arbitrary docs/blog/code-
reference links, and richer review/search surfaces.

`/vault/inbox` (`InboxCaptureList`, `apps/client/src/components/InboxCaptureList/`) is the shared
list view that doc calls for: rows grouped by route kind, each with an always-visible checkbox
column and an equal-width un/mark-reviewed column (`BookmarkIcon` accent-green when pending,
clickable `BookmarkCheckIcon` info-blue when reviewed — clicking it reverts to `new` via
`withInboxReviewState`), then thumbnail/title, meta badges, and a right-aligned action group
(external link, copy, delete) that stays pinned to the row edge via `margin-left: auto` regardless
of the grid's column-width remainder. Route-kind color-coding renders as a `left / Npx 100% no-repeat`
solid-stop gradient layered under the row's surface color (not a `box-shadow`, which visibly follows
an exaggerated curve at the row's rounded corners) — every row background state (default/hover/
checked) repeats the same gradient layer so the stripe survives all three. Broken thumbnails are
detected client-side only (an `<img onError>` swaps in a red `FileExclamationPointIcon` plus a
"Missing" badge; nothing is persisted to the node) and surfaced via a summary tile + toggleable
filter so they can be bulk-selected and deleted.

## Local Dev Ops

macOS persistence via `launchd` user agents (`com.llaab.server`, `com.llaab.client`,
`com.llaab.hermes.gateway`, `com.llaab.icons`) managed by `scripts/macos/llaab-service.sh`. SwiftBar plugin
(`llaab-swiftbar.15s.sh`) polls status every 15 s and shows three-state traffic-light indicators
(⚫ stopped · 🟡 launching · 🟢 running) with per-service submenus for start/stop. Individual
`start-*` commands wait for HTTP health before exiting so SwiftBar `refresh=true` fires only once
the service is genuinely up. Restart All includes Hermes. Repair Client lives in the LLAAB Client submenu.

The persistent Vite client defaults to dev/HMR. Preview mode builds into
`apps/client/.persistent/builds/<timestamp>`, promotes only successful builds to the
`apps/client/.persistent/current` symlink, and runs `vite preview` from that directory on failure
fallback to the last known-good build. `.claude/settings.json` holds a project-level allowlist for
`pnpm typecheck` and `launchctl list` to reduce permission prompts.
`com.llaab.client`'s plist points at `scripts/macos/start-persistent-client.sh`. A stale Vite
dependency-optimization cache (browser holds old `?v=` hashes after `@llaab/schemas` or another
workspace package rebuilds underneath the running server) shows up as "Failed to fetch dynamically
imported module" / "Outdated Optimize Dep" 504s — fix is `repair-persistent-client.sh` (bootout +
bootstrap), not editing source.

All workspace packages share one version (no independent publishing). `pnpm version:patch/minor/major`
runs `scripts/bump-version.ts`, which bumps every `packages/*` and `apps/*` `package.json` to the
same version in lockstep, re-syncs `pnpm-lock.yaml` (with `--ignore-scripts`, since plain
`--lockfile-only` was observed to overwrite `apps/client/.vscode/launch.json`'s schema version),
and auto-commits as `chore: <type> version bump to <version>`.

`apps/client/.persistent/` is still live (client only — not the server); it holds atomically-
promoted build staging (`builds/<timestamp>` → `current` symlink) so a broken `preview`-mode build
never goes live. `com.llaab.server` had been silently crash-looping (`launchctl print` showed
`forks` climbing) because `apps/server/src/index.ts` had no `uncaughtException`/`unhandledRejection`
handlers — any stray error (e.g. from the fire-and-forget `reconcileOrphanedActiveRuns()` call)
killed the whole Bun process, which launchd then cold-booted from scratch. Fixed: top-level error
handlers now log-and-survive, and `start-persistent-server.sh` does `mkdir -p ~/Library/Logs/llaab`
before launch so crash stderr isn't silently lost when launchd's own `KeepAlive` restart (not an
explicit `llaab-service.sh` command) is what relaunches the process.

TypeScript 7 resolves cross-package types through a `composite: true` package's **built `dist`
declarations**, not its `paths`-mapped source — even with no explicit tsconfig `"references"` entry.
A stale `dist` (package rebuilt less recently than its `src`) can silently hide newly-added
type-only exports, surfacing as a confusing `TS2305`/`TS2883` on a _consumer_ package that looks
unrelated. `turbo.json`'s `typecheck` task now `dependsOn: ["^build", "^typecheck"]` (previously
just `^typecheck`) so this can't recur — see `docs/todo/DONE_TS7_UPGRADE.md` for the full
investigation.

## Open Questions

- Tag origin tracking: separate `autoTags` / `manualTags` fields vs. post-hoc derivation?
- Skill extraction: LLM returns `skills[]` but only `IdeaNode`s are created — should extracted skills become `SkillNode`s?
- Harness package graduation: which token/chunk/context helpers should move from LLAAB-local
  extraction prep into `@finografic/ai-harness`?
