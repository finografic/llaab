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

| Package     | Role                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------- |
| `schemas`   | Zod schemas — 9 node types, ubiquitous language                                               |
| `core`      | Vault file I/O — `createNode`, `writeNode`, `readNode`, `listNodes`, `autoTag`                |
| `control`   | Execution governance — `execute()`, retry/reject, decision traces                             |
| `ingestion` | Fetch → clean → structure → store pipeline; extraction is a separate exported function        |
| `icons`     | Workspace icon registry package — runs `icons-server` + `lucide-manager`, exports app icons   |
| `llm`       | Task router + real providers (Anthropic SDK, Ollama npm) — `routeLlm`, `streamLlm`, 24h cache |
| `skills`    | Composed workflows — `captureIdea`, `ingestYouTube`, `runSkill`                               |
| `cli`       | Binary entry point (`llaab`) — citty commands: ingest, vault, agent, mcp                      |
| `client`    | Astro 6 + React 19 — pure UI, calls server via `src/lib/api.ts` (Hono typed RPC)              |
| `server`    | Hono + Bun — REST API on port 3000, owns all non-UI logic                                     |
| `vault/`    | Data directory — markdown files organized by node type (not a package)                        |

## Stack

- Runtime: Node.js 24, pnpm 10.32.1, Bun 1.2.2
- Build: Turborepo 2.x, TypeScript 5.9.3
- Validation: Zod 3.x
- Tests: Vitest 4.x
- Icons: `@finografic/icons` + `@finografic/lucide-manager` via `@llaab/icons`
- Server: Hono 4.x, http-status-codes, @hono/zod-validator
- Client: Astro 6, React 19, React Hook Form 7.x, @astrojs/react
- CSS: Tailwind CSS 4, shadcn/ui, app-local semantic CSS variables
- Linting: ESLint 9.x, typescript-eslint, oxfmt 0.42.0
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
`AppLayout` wraps `BaseLayout`, adds sidebar/header/footer shell. `login.astro` uses `BaseLayout` directly.
Inner pages use `PageLayout` (hero / optional aside / main zones) + `PageHero` (eyebrow, title, actions slot, meta bar). See `LAYOUT_AND_PAGES_GUIDE.md`.
`FileList` exists as a reusable TanStack-based list component for Finder-style index views.

CSS entry points: `packages/ui/src/styles/globals.css` owns all framework imports (Tailwind,
`tw-animate-css`, `shadcn/tailwind.css`, Roboto), the shadcn stone token `:root`/`.dark` blocks,
and the `@theme inline` + `@custom-variant dark` directives. `apps/client/src/styles/app.css`
imports `forms.css` only, then adds app-specific semantic tokens (`--bg`, `--surface`, `--text`,
`--accent`, `--space-*`, `--font-mono`, etc.) and overrides the shadcn tokens with LLAAB's warm
amber dark palette in `:root {}`. `BaseLayout.astro` imports both in order.
Dark mode is always active via `class="dark"` on `<html>` (hardcoded — LLAAB is dark-only).
Installed shadcn components in `packages/ui/src/components/`: `button`, `badge`, `breadcrumb`,
`scroll-area`, `table`, `tooltip`.
`@llaab/client` can import generated local icons from `@llaab/icons`; `src/pages/index.astro`
already does this for its four homepage icons.

| Route                     | Description                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `/ingest`                 | URL form with card-wide drag/drop; two-phase: ingest fires first → Transcript Saved card, then extraction |
| `/llm`                    | LLM status dashboard: task→tier→model routing with installed/missing dots, Ollama model list              |
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
| `POST /api/agent/run`                     | One-shot agent processor; optional `{ nodeId?, force? }`                        |
| `GET /api/agent/status`                   | Last run metadata                                                               |

### `@llaab/icons` — Workspace icon registry package

Owns `icons.config.json`, `icons.generated.ts`, and the package export surface for generated icons.
Consumer imports use `@llaab/icons` rather than root files. The package runs as its own Turbo `dev`
task and starts three sidecars: `icons-server`, `lucide-manager`, and generated-export syncing.
LLAAB suppresses auto-opening the picker by setting `LUCIDE_MANAGER_OPEN=false` in the package `dev`
script because `icons-server` rewrites `lucide-manager.config.json` on startup.

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
Extraction input is still truncated to 6 000 chars before the LLM call to avoid 8k context
overflow, but that truncation now runs through a small harness-based prep pipeline inside
`packages/ingestion/src/extract/`.

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

## Roadmap & Planning

Primary plan: `docs/todo/ROADMAP.md`. Near-term tasks: `docs/todo/NEXT_STEPS.md`.
P1: install + validate `@finografic/ai-harness` in transcript extraction. P2: Terminal Panel and
later harness extension. P3: Karpathy graph, Source Auto-Follow, Library Watch.
TODO/DONE doc conventions: `.github/instructions/documentation/todo-done-docs.instructions.md`.

## Local Dev Ops

macOS persistence is handled outside the app via `launchd` user agents plus a SwiftBar plugin in
`scripts/macos/`. SwiftBar exposes `Open App`, `Open Ingest`, and `Open Icons`; the icons picker
target is `http://localhost:5199/`.

## Open Questions

- Tag origin tracking: separate `autoTags` / `manualTags` fields vs. post-hoc derivation?
- Skill extraction: LLM returns `skills[]` but only `IdeaNode`s are created — should extracted skills become `SkillNode`s?
- After real transcript testing, does the broader harness extension become a more urgent blocker
  than Terminal / Command Panel?
