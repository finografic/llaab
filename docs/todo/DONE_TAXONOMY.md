# DONE — Taxonomy System

> **Completed:** 2026-04-16

---

## What's done

- [x] `autoTag(title, body)` + `AUTO_TAG_PATTERNS` in `packages/core/src/taxonomy.ts`
- [x] `@llaab/core` exports `autoTag` and `AUTO_TAG_PATTERNS`
- [x] `captureIdea` in `@llaab/skills` imports `autoTag` from core (no local copy)
- [x] `runIngestionPipeline` in `@llaab/ingestion` applies `d:ingest` + `autoTag` on all nodes
- [x] Old non-prefixed tags (`ingested`, `youtube`, `tooling`, `graph`, `execution`) removed
- [x] Source nodes carry no domain tags (per spec — they're containers, not content)
- [x] `docs/taxonomy/TAXONOMY_GUIDE.md` written

---

## Remaining work

### 1. TagsInput UI on Ingest Form ✓

Wire the `TagsInput` component from `@finografic/design-system` (Ark UI) into `IngestForm.tsx`
so users can add manual tags before submitting. Auto-inferred tags are added server-side; this
input collects explicit overrides/additions.

**Acceptance criteria:**

- Renders below the URL field inside the card
- Accepts `d:` prefixed tags (or plain domain names — normalize to `d:` prefix on submit)
- Suggestions list: the 8 known `d:` tags, shown as you type
- Submitted tags are passed in the POST body `{ url, tags: string[] }`
- Server merges explicit tags with auto-inferred (dedup via `Set`)

**Refs:**

- Ark UI TagsInput: `https://ark-ui.com/docs/components/tags-input`
- `@finografic/design-system` TagsInput wrapper (check DS for exact import path)

---

### 2. Tag display on Vault / node cards ✓

Show domain tags as colored pills on:

- Vault list items
- Run detail pages (tags of the ingested node)
- Any future node card component

Use solid fill for auto-inferred, outline for manually added. This requires tracking tag origin
in the node — options:

- Add `autoTags: string[]` + `manualTags: string[]` to node frontmatter (separate arrays)
- Derive post-hoc by re-running `autoTag` on stored content and diffing against `tags`

Simplest first cut: render all tags solid (no origin distinction) until the split is decided.

**Colors per tag** (see TAXONOMY_GUIDE.md for full rationale):

| Tag             | Hex                    |
| --------------- | ---------------------- |
| `d:llm`         | `#3b82f6` (blue-500)   |
| `d:automation`  | `#8b5cf6` (violet-500) |
| `d:ingest`      | `#f59e0b` (amber-500)  |
| `d:schema`      | `#14b8a6` (teal-500)   |
| `d:infra`       | `#6b7280` (gray-500)   |
| `d:integration` | `#f97316` (orange-500) |
| `d:ui`          | `#ec4899` (pink-500)   |
| `d:meta`        | `#22c55e` (green-500)  |

---

### 3. Normalize tag input ✓

If a user types `llm` instead of `d:llm` in the TagsInput, auto-prefix it on submit.
This makes the UI friendlier without requiring users to know the prefix convention.

Implementation: a `normalizeTag(raw: string): string` helper that prepends `d:` if no prefix
and the value matches a known domain name.

---

### 4. Place `04_IDEAS_TO_SKILLS.md` in `@llaab/skills` ✓

The updated doc is ready at `.claude/assets/taxonomy-files-updated/04_IDEAS_TO_SKILLS.md` —
it already has the correct 8-tag `d:` table and updated `captureIdea` example. Just needs to
be placed at `packages/skills/docs/04_IDEAS_TO_SKILLS.md` (create the `docs/` folder if needed).

---

### 5. `ingestArticle` skill (note — out of scope here, tracked separately)

The blog-post ingestion scenario assumes an `ingestArticle` entry point that doesn't exist yet.
The `runIngestionPipeline` in `@llaab/ingestion` already supports `sourceType: 'article'` and
applies `autoTag` — so the pipeline is ready. What's missing is a `ingestArticle` skill wrapper
in `@llaab/skills` mirroring `ingestYouTube`, plus a fetch/parse stage for article HTML.
Add to ROADMAP P3 or alongside `apps/server` work (an `/api/ingest/article` route would need it).

---

## Open questions

- **Tag origin tracking:** separate `autoTags` / `manualTags` fields vs. derive post-hoc?
  Separate fields are honest but change the schema. Post-hoc derivation is zero-schema-change
  but fragile if patterns change. Decide before implementing the solid/outline UI.

- **Filtering UI:** a sidebar tag filter on the vault browser? Low priority until there are
  enough nodes to make filtering useful (target: 20+ nodes).
