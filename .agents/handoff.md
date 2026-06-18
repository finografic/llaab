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
Core pipeline: ingest YouTube → transcript → extracted ideas → canonical ideas → run traces, all
stored as markdown vault nodes. Executable/generated skills are future work, not current ingest
output.

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
- Build: Turborepo 2.x, TypeScript 5.9.3
- Validation: Zod 4.x
- Tests: Vitest 4.x
- Icons: `@finografic/icons` + `@finografic/lucide-manager` via `@llaab/icons`
- Server: Hono 4.x, http-status-codes, @hono/zod-validator
- Client: Vite 8, React 19, React Router v7, React Hook Form 7.x, `@pierre/trees` (git-status file tree)
- CSS: Tailwind CSS 4, shadcn/ui, app-local semantic CSS variables
- Linting: oxlint + oxfmt (`@finografic/oxc-config`); Prettier for markdown and legacy formats where needed
- Hooks: husky + lint-staged (pre-commit: lint + format + typecheck)
- Commits: commitlint

## Apps

### `@llaab/client` — Vite 8 + React Router SPA (port 3000)

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
shortcuts (ingest, transcripts, LLM, icons). `SecondaryActionBar` holds global contextual
actions — Clean Vault (dialog), Vault Changes, Activity Monitor (renamed from "Run Monitor" —
it's not ingest-specific anymore) — that share the single sidebar slot: `AppLayout` owns
`activePanel: 'runs' | 'vaultGit' | null` as the one source of truth for which panel renders
(mutually exclusive), syncing it to the resizable panel imperatively via `usePanelRef()`.
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
`VaultGitPanel` (`apps/client/src/components/VaultGitPanel/`) shows `git status` scoped to `vault/`
via `@pierre/trees`'s `FileTree` (themed to the app's dark palette via its CSS custom-property
overrides), grouped by node type, with an auto-generated commit message
(`chore(vault): commit N files` + per-type bullet breakdown), a Commit button, and a Reset button
(discards all uncommitted `vault/` changes — `git checkout HEAD` + `git clean -fd`, both scoped to
`vault/` — behind a confirm dialog). Server-side git operations
(`apps/server/src/routes/vault/vault-git.routes.ts`) shell out to `git` scoped with a `-- vault`
pathspec for status/commit/reset. The git-status query refetches after _any_ mutation in the app
succeeds (subscribes to the TanStack `MutationCache`), not just a few manually-wired ones — nearly
every mutation here can touch `vault/` files, so this stays correct without per-mutation wiring.
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
Homepage (`routes/root.tsx`) callout cards: Ingest, Vault, Runs, Models (2×2 via `BalancedGrid`).
`/icons` redirects to `/dev/icons` (Lucide picker / registry).

| Route                    | Description                                                                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                      | Home dashboard — four callout cards (Ingest, Vault, Runs, Models)                                                                                     |
| `/ingest`                | URL form with card-wide drag/drop; two-phase ingest; `RunPipelineCard` progress + grouped `RunsTable` (collapsed by subject, sortable published date) |
| `/llm`                   | LLM status dashboard: task→tier→model routing with installed/missing dots, Ollama model list                                                          |
| `/icons`                 | Redirect to `/dev/icons` (embedded Lucide picker)                                                                                                     |
| `/vault`                 | Gated file-tree browser — local recursive tree + raw file viewer                                                                                      |
| `/vault/transcripts/:id` | Detail: source metadata, extraction runs, canonical ideas/coverage, extracted ideas, Re-extract                                                       |
| `/vault/nodes`           | PageLayout + NodesFileList; nodes by type (idea/resource/prompt/skill/instruction)                                                                    |
| `/vault/nodes/:id`       | Detail: breadcrumb, title/type/status/date, tags, body, type-specific fields                                                                          |
| `/vault/sources/:id`     | Detail: kind/follow/url/profiles, add linked GitHub profile, transcripts table with idea count                                                        |
| `/vault/runs/:id`        | Detail: summary grid, stages table, decisions list, error block                                                                                       |

`AppSidebarLayout` (`packages/ui/src/components/app-sidebar-layout.tsx`) supports both
percentage and absolute-unit (`px`/`rem`) sidebar sizing — `isPercentOrBare()` only computes
main-panel percentage complements when `minWidth`/`maxWidth`/`defaultWidth` are all percent/bare
numbers; absolute-unit sidebars give the main panel `minSize="1%"` and `undefined` default/max so
it doesn't collapse. `SidebarSplitLayout` (`apps/client/src/components/SidebarSplitLayout/`) wraps
`AppSidebarLayout` with a `PanelLeftIcon` collapse/expand toggle (`usePanelRef`) alongside the
manual resize handle; `TranscriptsSplitView` uses it with a 600px-minimum sidebar containing the
`TranscriptsSplitView` uses it with a 600px-minimum sidebar containing the transcript list.
`/vault/transcripts` index auto-navigates to the latest transcript by `created_at`. Each sidebar
list item can show `ExtractionModelCard`
(`apps/client/src/components/ExtractionModelCard/`) variants: `compact` for a latency-only badge,
`compact-bar` for inline model/provider pills plus right-aligned token/latency metrics (`showModel` /
`showTotalTokens` toggles), and `full` for the transcript detail card. Consolidate on transcript
detail shows a heartbeat elapsed timer while pending. `ExtractionModelCard` wraps `ai-latency-meter`/`ai-token-viewer`
(`packages/ui/src/components/`, ported from tryelements.dev) — cost display is omitted because
local models have no pricing data.

A 12-column flexbox grid (`Container`/`Row`/`Col`, Bootstrap-style, Tailwind-matching breakpoints,
no Context/runtime JS) lives at `packages/ui/src/components/grid/` (ported from
`@finografic/design-system`), imported via `components/ui/grid`; CSS auto-included via
`packages/ui/src/styles/globals.css`. Grid utilities coexist with Tailwind classes, but Tailwind
font utilities still follow Tailwind names (`text-base`, `text-lg`, etc.); app CSS tokens such as
`--text-md` do not automatically create a `text-md` utility. Docs: `docs/components/grid.md`.

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
| `GET /api/vault/nodes`                                             | `listNodes()` — `?type`, `?status`, `?tags`, `?search`, `?limit`                                                                                                                                              |
| `GET /api/vault/nodes/:id`                                         | Single node by id                                                                                                                                                                                             |
| `PATCH /api/vault/sources/:id/profiles`                            | Updates linked source profiles (GitHub first)                                                                                                                                                                 |
| `GET /api/vault/transcripts/:id/ideas`                             | Returns `{ ideas: {id, title}[] }` from transcript's `extracted_idea_ids`                                                                                                                                     |
| `POST /api/vault/transcripts/:id/extract`                          | Run LLM extraction on a saved transcript; returns `{ success, ideaIds, ideas }`                                                                                                                               |
| `POST /api/vault/transcripts/:id/consolidate`                      | Single-pass canonical idea generation with quality validation from extracted candidate ideas; `RunNode`-backed (`runSkill`); returns `conflict: true` instead of overwriting coverage if a set already exists |
| `POST /api/vault/transcripts/:id/canonical-ideas/resolve-conflict` | `{ keep: 'existing' \| 'incoming' }` — deletes the losing set's files, writes coverage if incoming wins                                                                                                       |
| `POST /api/vault/transcripts/:id/canonical-ideas/clean`            | Deletes every canonical-idea file + consolidate run for that transcript (incl. orphans) and clears coverage                                                                                                   |
| `GET /api/runs`, `/:id`                                            | Run list + detail with full stage/decision trace                                                                                                                                                              |
| `GET /api/runs/monitor`                                            | App-shell run monitor DTO: active/recent runs, steps, links, compact summaries                                                                                                                                |
| `GET /api/vault/git/status`                                        | `git status` scoped to `vault/`, categorized by node type, with a generated commit message                                                                                                                    |
| `POST /api/vault/git/commit`                                       | `git add`/`git commit -- vault` using the generated commit message                                                                                                                                            |
| `POST /api/vault/git/reset`                                        | `git checkout HEAD` + `git clean -fd`, both scoped to `vault/` — discards all uncommitted vault changes                                                                                                       |
| `POST /api/llm/complete`                                           | Routed LLM completion — `{ task, prompt, system?, model?, maxTokens? }`                                                                                                                                       |
| `POST /api/llm/stream`                                             | SSE streaming LLM                                                                                                                                                                                             |
| `GET /api/llm/models`                                              | Lists installed Ollama models                                                                                                                                                                                 |
| `GET /api/llm/status`                                              | Task routing config + installed models cross-referenced                                                                                                                                                       |
| `GET /api/llm/capabilities`                                        | Provider capability metadata + availability                                                                                                                                                                   |
| `POST /api/agent/run`                                              | One-shot agent processor; optional `{ nodeId?, force? }`                                                                                                                                                      |
| `GET /api/agent/status`                                            | Last run metadata                                                                                                                                                                                             |

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

## LLM Layer

Task routing (all env-configurable via `LLAAB_*_MODEL` vars):

| Task        | Tier         | Default model         |
| ----------- | ------------ | --------------------- |
| format      | local-small  | llama3.2:3b           |
| extract     | local-mid    | llama3:latest         |
| consolidate | local-strong | gemma4:26b-a4b-it-qat |
| code        | local-mid    | llama3:latest         |
| reason      | remote       | claude-sonnet-4-6     |

Canonical consolidation uses extracted idea nodes only, not the full transcript body. It runs a
single pass through `routeLlm("consolidate", ...)`, validates quality deterministically (with
optional auto-retry), persists `CanonicalIdeaNode` files with `key_claims` / `coverage_notes`, and
writes `TranscriptNode.canonical_coverage` metadata (including `quality_score`) so the transcript
UI can show coverage and score after reload. Default model: `gemma4:26b-a4b-it-qat` on the
`consolidate` task route.

`getLlmStatus()` exported from `@llaab/llm` returns the live routing map (respects env overrides).
Ollama provider uses `chat` API (not `generate`) for proper system/user separation.
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

Run persistence compacts large duplicated text fields (`body`, `plainText`, `text`, `transcript`)
inside summaries and stage payloads. Existing June 13 ingest run files were migrated. Run deletion
uses produced-node reference checks so shared transcripts/sources and canonical-referenced ideas are
preserved unless no remaining graph reference exists. `POST /api/vault/runs/delete-preview` returns
nodes-to-delete/preserved/canonical-ideas-affected before a destructive single or batch delete; both
`DeleteRunAction` and `DeleteRunGroupAction` render this preview before confirming.

`RunNode.monitor_dismissed_at` (optional timestamp) marks a run as dismissed from the Run Monitor's
"Recent" list without deleting the run node/file. `POST /api/runs/:id/dismiss` sets it via
`updateNode`; `GET /api/runs/monitor` excludes runs with this field from `recent`. `RunMonitor`'s
Dismiss button calls `useDismissRun` (in addition to local `dismissedRunIds` zustand state) so the
dismissal persists across reloads.

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
auth live on `apps/server`. **Ports:** client **3000**, server **8888** (icons 5001/5199).
**Env:** `LLAAB_API_URL` (Vite proxy only), `LLAAB_API_KEY` (server), optional `VAULT_PASSWORD`
(unset = open vault). Client uses same-origin `/api/*` and proxied `/terminal` WebSocket — no
API keys in the browser bundle. `@llaab/core` / `@llaab/ingestion` removed from client deps.
Persistent launchd client uses staged `vite build` + `vite preview` (`.persistent/builds/`).
Post-migration fixes: ingest `RunsTable` groups runs by subject with sortable YouTube publish date
(`extractRunPublishedAt` from `fetch:youtube` stage), collapsed child rows, and aligned metrics;
YAML `profiles` object-array parsing so all source nodes load for runs author links.

## Roadmap & Planning

Primary plan: `docs/todo/ROADMAP.md`. Near-term tasks: `docs/todo/NEXT_STEPS.md`.
Current orchestration plan: `docs/todo/DONE_ORCHESTRATION.md`.
UI Refactor (all 3 phases) and horizontal nav menu migration are complete as of 2026-06-07. P0 is empty.
Orchestration phases 0–10 are complete. The Phase 6b addendum content is consolidated into
`DONE_ORCHESTRATION.md`; there is no separate addendum tracking file.
TODO/DONE doc conventions: `.github/instructions/documentation/todo-done-docs.instructions.md`.

## Local Dev Ops

macOS persistence via `launchd` user agents (`com.llaab.server`, `com.llaab.client`,
`com.llaab.icons`) managed by `scripts/macos/llaab-service.sh`. SwiftBar plugin
(`llaab-swiftbar.15s.sh`) polls status every 15 s and shows three-state traffic-light indicators
(⚫ stopped · 🟡 launching · 🟢 running) with per-service submenus for start/stop. Individual
`start-*` commands wait for HTTP health before exiting so SwiftBar `refresh=true` fires only once
the service is genuinely up. Repair Client lives in the LLAAB Client submenu.

The persistent Vite client builds into `apps/client/.persistent/builds/<timestamp>`, promotes
only successful builds to the `apps/client/.persistent/current` symlink, and runs `vite preview`
from that directory on failure fallback to the last known-good build. `.claude/settings.json` holds a project-level allowlist for
`pnpm typecheck` and `launchctl list` to reduce permission prompts.

All workspace packages share one version (no independent publishing). `pnpm version:patch/minor/major`
runs `scripts/bump-version.ts`, which bumps every `packages/*` and `apps/*` `package.json` to the
same version in lockstep, re-syncs `pnpm-lock.yaml` (with `--ignore-scripts`, since plain
`--lockfile-only` was observed to overwrite `apps/client/.vscode/launch.json`'s schema version),
and auto-commits as `chore: <type> version bump to <version>`.

## Open Questions

- Tag origin tracking: separate `autoTags` / `manualTags` fields vs. post-hoc derivation?
- Skill extraction: LLM returns `skills[]` but only `IdeaNode`s are created — should extracted skills become `SkillNode`s?
- Harness package graduation: which token/chunk/context helpers should move from LLAAB-local
  extraction prep into `@finografic/ai-harness`?
