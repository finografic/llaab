# llaab — Handoff

> **How to maintain this file**
> Update after sessions that change architecture, add/remove features, resolve open questions, or shift priorities — not every session.
> — Update only the sections that changed. Keep the total under 150 lines.
> — Write in present tense. No code snippets — describe what exists, not how it works.
> — `.agents/memory.md` = session work log. `.agents/handoff.md` = project state snapshot. Never duplicate between the two.

---

## Project

`llaab` — Learning Loop & Agent Automation Base. Turborepo + pnpm monorepo. Two-process
architecture: `apps/server` (Hono + Bun, business logic) + `apps/client` (Astro + React, UI).
Core pipeline: ingest YouTube → transcript → ideas → skills → run traces, all stored as markdown
vault nodes.

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
| `client`    | Astro 6 + React 19 — pure UI, calls server via `src/lib/api.ts` (Hono typed RPC)                                               |
| `server`    | Hono + Bun — REST API on port 3000, owns all non-UI logic                                                                      |
| `vault/`    | Data directory — markdown files organized by node type (not a package)                                                         |

## Stack

- Runtime: Node.js 24, pnpm 10.32.1, Bun 1.2.2
- Build: Turborepo 2.x, TypeScript 5.9.3
- Validation: Zod 4.x
- Tests: Vitest 4.x
- Icons: `@finografic/icons` + `@finografic/lucide-manager` via `@llaab/icons`
- Server: Hono 4.x, http-status-codes, @hono/zod-validator
- Client: Astro 6, React 19, React Hook Form 7.x, @astrojs/react
- CSS: Tailwind CSS 4, shadcn/ui, app-local semantic CSS variables
- Linting: oxlint + oxfmt (`@finografic/oxc-config`); Prettier retained for Astro files only
- Hooks: husky + lint-staged (pre-commit: lint + format + typecheck)
- Commits: commitlint

## Apps

### `@llaab/client` — Astro 6 + React 19 (port 4321)

Pure UI. All data calls go to `@llaab/server` via `src/lib/api.ts` (Hono typed RPC client).
Vite dev proxy forwards `/api/*` → `SERVER_URL` (default `http://localhost:3000`).
Client styling: Tailwind v4 + shadcn/ui. shadcn components live in `packages/ui/src/components/`
(imported via `@llaab/ui/components/<name>`); a parallel set of app-local copies with local import
paths lives in `src/components/ui/` and is what all current React code imports via `components/ui/`.
The old PandaCSS + linked design-system stack has been removed from the client.
Vault pages load data directly via `@llaab/core` in frontmatter (no API hop); auth gate at top.

Layout hierarchy: `BaseLayout` owns `<html class="dark">/<head>/<body>` + CSS imports.
`AppLayout` wraps `BaseLayout` with horizontal header + main + footer (sidebar removed 2026-06-07).
`AppHeader` hosts the `NavMenu` React island (brand link + shadcn megamenus + mobile sheet).
Inner pages use `PageLayout` (hero / optional aside / main zones) + `PageHero`. See `LAYOUT_AND_PAGES_GUIDE.md`.
Navigation structure: `lib/nav-menu.config.ts`; design spec: `docs/NAV_MENU_DESIGN.md`.
Home dashboard uses `BalancedGrid` + `utils/balanced-grid.utils.ts` to avoid orphan cards in multi-column grids.

CSS entry points: `packages/ui/src/styles/globals.css` owns all framework imports (Tailwind,
`tw-animate-css`, `shadcn/tailwind.css`, Roboto), the shadcn stone token `:root`/`.dark` blocks,
and the `@theme inline` + `@custom-variant dark` directives. `apps/client/src/styles/app.css`
imports `forms.css` only, then adds app-specific semantic tokens (`--bg`, `--surface`, `--text`,
`--accent`, `--space-*`, `--font-mono`, etc.), a `rem`-based type scale (`--text-2xs` 9px through
`--text-4xl` 36px — all font sizes in the client use these so `html { font-size }` controls the
whole UI), and overrides the shadcn tokens with LLAAB's warm amber dark palette in `:root {}`.
`BaseLayout.astro` imports both in order. `forms.css` retains only native element resets for
`input`, `textarea`, and `select` — all hand-rolled component classes were removed.
Dark mode is always active via `class="dark"` on `<html>` (hardcoded — LLAAB is dark-only).
Installed shadcn components in `packages/ui/src/components/` include `navigation-menu`, `sheet`,
`accordion`, `button`, `badge`, `breadcrumb`, `scroll-area`, `table`, `tooltip`.
Homepage (`index.astro`) callout cards: Ingest, Vault, Runs, Models (2×2 via `BalancedGrid`).
`/icons` redirects to `/dev/icons` (Lucide picker / registry).

| Route                     | Description                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `/`                       | Home dashboard — four callout cards (Ingest, Vault, Runs, Models)                                         |
| `/ingest`                 | URL form with card-wide drag/drop; two-phase: ingest fires first → Transcript Saved card, then extraction |
| `/llm`                    | LLM status dashboard: task→tier→model routing with installed/missing dots, Ollama model list              |
| `/icons`                  | Redirect to `/dev/icons` (embedded Lucide picker)                                                         |
| `/vault`                  | Gated file-tree browser — local recursive tree + raw file viewer                                          |
| `/vault/transcripts/[id]` | Detail: source metadata, summary, extracted ideas (linked), Re-extract button                             |
| `/vault/nodes`            | PageLayout + NodesFileList island; nodes by type (idea/resource/prompt/skill/instruction)                 |
| `/vault/nodes/[id]`       | Detail: breadcrumb, title/type/status/date, tags, body, type-specific fields                              |
| `/vault/sources/[id]`     | Detail: kind/follow/url/platforms, linked transcripts with idea count                                     |
| `/vault/runs/[id]`        | Detail: summary grid, stages table, decisions list, error block                                           |

### `@llaab/server` — Hono + Bun (port 3000)

Auth: `X-API-Key` vs `SERVER_API_KEY` env. No key set = dev mode, auth skipped.
Each route group: `*.schema.ts` (Zod), `*.routes.ts` (`{ path, handler }` exports), `index.ts` (wiring).
Long-running ingest and extract routes explicitly disable Bun's per-request idle timeout so the
client does not receive false network failures while the server continues extracting.

| Route                                     | Description                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| `POST /api/ingest/youtube`                | `ingestYouTube` skill — `{ url, title?, tags?, skipExtraction? }`               |
| `GET /api/vault/nodes`                    | `listNodes()` — `?type`, `?status`, `?tags`, `?search`, `?limit`                |
| `GET /api/vault/nodes/:id`                | Single node by id                                                               |
| `GET /api/vault/transcripts/:id/ideas`    | Returns `{ ideas: {id, title}[] }` from transcript's `extracted_idea_ids`       |
| `POST /api/vault/transcripts/:id/extract` | Run LLM extraction on a saved transcript; returns `{ success, ideaIds, ideas }` |
| `GET /api/runs`, `/:id`                   | Run list + detail with full stage/decision trace                                |
| `POST /api/llm/complete`                  | Routed LLM completion — `{ task, prompt, system?, model?, maxTokens? }`         |
| `POST /api/llm/stream`                    | SSE streaming LLM                                                               |
| `GET /api/llm/models`                     | Lists installed Ollama models                                                   |
| `GET /api/llm/status`                     | Task routing config + installed models cross-referenced                         |
| `GET /api/llm/capabilities`               | Provider capability metadata + availability                                     |
| `POST /api/agent/run`                     | One-shot agent processor; optional `{ nodeId?, force? }`                        |
| `GET /api/agent/status`                   | Last run metadata                                                               |

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

| Task    | Tier        | Default model     |
| ------- | ----------- | ----------------- |
| format  | local-small | llama3.2:3b       |
| extract | local-mid   | llama3:latest     |
| code    | local-mid   | llama3:latest     |
| reason  | remote      | claude-sonnet-4-6 |

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

| Type             | Description                                                                       |
| ---------------- | --------------------------------------------------------------------------------- |
| `TranscriptNode` | Ingested content; `source_url`, `source_type`, `summary` (optional), length stats |
| `IdeaNode`       | Captured thought; `origin` (manual/extracted/generated), optional `source_id`     |
| `SkillNode`      | Executable knowledge; inputs/outputs/tools, lineage                               |
| `SourceNode`     | Person/channel/repo origin; `platforms`, `follow` flag                            |
| `RunNode`        | Execution trace; `stages`, `decisions`, LLM trace, `produced_node_ids`            |

## Taxonomy

Tags use a single `d:` prefix. 8 domain tags: `d:llm`, `d:automation`, `d:ingest`, `d:schema`,
`d:infra`, `d:integration`, `d:ui`, `d:meta`. `autoTag(title, body)` in `@llaab/core` infers tags
via regex. All ingest runs apply `d:ingest` + `autoTag`. Source nodes carry no domain tags.

LLM-extracted content tags (`IdeaNode.tags`) are required (`z.array(z.string()).min(1)`) and the
extraction prompt's few-shot example deliberately uses an orthogonal domain (cooking) with an
anti-copying instruction — small local models otherwise anchor on the example's wording/tags for
in-domain (AI/LLM) input and either echo it verbatim or omit `tags`. `IngestForm` tag suggestions
blend `KNOWN_TAGS` with tags ranked by usage across existing vault nodes (`vaultTagsByUsage`).

## Client Data Fetching

`apps/client` reads/mutates vault data via TanStack Query hooks grouped by domain under
`src/queries/<domain>/` (`runs`, `transcripts`, `nodes`, `vault`) — each a barrel exporting
`QUERY_KEYS.<domain>` plus typed query/mutation hooks that call `api.*` (`lib/api`, the typed
Hono RPC client) directly, no hand-written `endpoints/` layer. A single `QueryClient` singleton
(`providers/QueryClientProvider/queryClient.ts`) is shared across all Astro islands — each
`client:load`/`client:only` mounts an independent React root, so every island root that reads or
mutates query state is wrapped directly in `<QueryClientProvider client:*>` in its `.astro` page
(only the wrapper carries the `client:*` directive). The old `lib/runs-events`
(`dispatchRunsChanged`/`RUNS_CHANGED_EVENT`) custom event bus and `lib/use-runs` are gone —
mutation hooks declare `invalidateQueries` against `QUERY_KEYS` in their `onSuccess`/`onSettled`.
Full migration writeup: `docs/todo/DONE_QUERIES_MIGRATION.md`.

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

The persistent Astro client builds into `apps/client/.persistent/builds/<timestamp>`, promotes
only successful builds to the `apps/client/.persistent/current` symlink, and falls back to the
last known-good build on failure. `.claude/settings.json` holds a project-level allowlist for
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
