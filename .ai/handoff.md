# llaab — Handoff

> **How to maintain this file**
> Update after sessions that change architecture, add/remove features, resolve open questions, or shift priorities — not every session.
> — Update only the sections that changed. Keep the total under 150 lines.
> — Write in present tense. No code snippets — describe what exists, not how it works.
> — `.claude/memory.md` = session work log. `.ai/handoff.md` = project state snapshot. Never duplicate between the two.

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
- Server: Hono 4.x, http-status-codes, @hono/zod-validator
- Client: Astro 6, React 19, React Hook Form 7.x, @astrojs/react
- CSS: Panda CSS 1.9.1, `@finografic/design-system` (linked local)
- Linting: ESLint 9.x, typescript-eslint, oxfmt 0.42.0
- Hooks: husky + lint-staged (pre-commit: lint + format + typecheck)
- Commits: commitlint

## Apps

### `@llaab/client` — Astro 6 + React 19 (port 4321)

Pure UI. All data calls go to `@llaab/server` via `src/lib/api.ts` (Hono typed RPC client).
Vite dev proxy forwards `/api/*` → `SERVER_URL` (default `http://localhost:3000`).
Ark UI components (TagsInputDS) must use `client:only="react"` — SSR causes dispatcher null errors.
Vault pages load data directly via `@llaab/core` in frontmatter (no API hop); auth gate at top.

Layout hierarchy: `BaseLayout` owns `<html class="dark">/<head>/<body>` + CSS imports.
`AppLayout` wraps `BaseLayout`, adds sidebar/header/footer shell. `login.astro` uses `BaseLayout` directly.

CSS: `app.css` imports `styled-system/styles.css` (Panda tokens) first, then DS global.css, then forms.css.
Base reset and app globals wrapped in `@layer base {}` so Panda `@layer utilities` wins the cascade.
Dark mode is always active via `class="dark"` on `<html>` (hardcoded — LLAAB is dark-only).
Primary color (indigo) is set in `panda.config.ts` via `createColorTokens({ primary: 'oklch(59% 0.234 277)' })`.

| Route                     | Description                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| `/ingest`                 | YouTube URL form; two-phase: ingest fires first → Transcript Saved card, then extraction     |
| `/llm`                    | LLM status dashboard: task→tier→model routing with installed/missing dots, Ollama model list |
| `/vault`                  | Gated file-tree browser — raw vault file viewer                                              |
| `/vault/transcripts/[id]` | Detail: source metadata, summary, extracted ideas (linked), Re-extract button                |
| `/vault/nodes/[id]`       | Detail: breadcrumb, title/type/status/date, tags, body, type-specific fields                 |
| `/vault/sources/[id]`     | Detail: kind/follow/url/platforms, linked transcripts with idea count                        |
| `/vault/runs/[id]`        | Detail: summary grid, stages table, decisions list, error block                              |

### `@llaab/server` — Hono + Bun (port 3000)

Auth: `X-API-Key` vs `SERVER_API_KEY` env. No key set = dev mode, auth skipped.
Each route group: `*.schema.ts` (Zod), `*.routes.ts` (`{ path, handler }` exports), `index.ts` (wiring).

| Route                                     | Description                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| `POST /api/ingest/youtube`                | `ingestYouTube` skill — `{ url, title?, tags?, skipExtraction? }`        |
| `GET /api/vault/nodes`                    | `listNodes()` — `?type`, `?status`, `?tags`, `?search`, `?limit`         |
| `GET /api/vault/nodes/:id`                | Single node by id                                                        |
| `POST /api/vault/transcripts/:id/extract` | Run LLM extraction on a saved transcript; returns `{ success, ideaIds }` |
| `GET /api/runs`, `/:id`                   | Run list + detail with full stage/decision trace                         |
| `POST /api/llm/complete`                  | Routed LLM completion — `{ task, prompt, system?, model?, maxTokens? }`  |
| `POST /api/llm/stream`                    | SSE streaming LLM                                                        |
| `GET /api/llm/models`                     | Lists installed Ollama models                                            |
| `GET /api/llm/status`                     | Task routing config + installed models cross-referenced                  |
| `POST /api/agent/run`                     | One-shot agent processor; optional `{ nodeId?, force? }`                 |
| `GET /api/agent/status`                   | Last run metadata                                                        |

## Ingestion Pipeline

Two-phase split — transcript always saved first, extraction is best-effort:

1. `runIngestionPipeline` — fetches YouTube, parses/cleans transcript, saves `TranscriptNode` + `SourceNode`. No LLM call.
2. `extractKnowledgeFromTranscript(id, path, plainText)` — runs `llmExtractWithTrace` (input truncated to 6 000 chars), updates transcript `summary`, creates `IdeaNode`s.

The ingest UI fires these as two sequential API calls so the user sees phase-by-phase feedback.
`skipExtraction: true` on the ingest endpoint makes step 1 return immediately (no LLM blocking).

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
Extraction input is truncated to 6 000 chars before the LLM call to avoid 8k context overflow.

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
P0 + P1 empty. P2: Terminal Panel. P3: oxlint (phase 1 done), Zod v4, Karpathy graph, Source Auto-Follow, Library Watch.
TODO/DONE doc conventions: `.github/instructions/documentation/todo-done-docs.instructions.md`.

## Open Questions

- Extraction still failing at runtime ("Network error") — root cause unclear; Re-extract button on transcript detail page can be used to retry and surface the real server error message.
- Tag origin tracking: separate `autoTags` / `manualTags` fields vs. post-hoc derivation?
- Skill extraction: LLM returns `skills[]` but only `IdeaNode`s are created — should extracted skills become `SkillNode`s?
- Re-extract button on failed ingest card (noted, not yet built).
