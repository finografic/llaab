# TODO — Idea Tag Relevance

> **Status:** P0 — fix next / verify next. The fix has moved to a schema-level change
> (LLM returns per-idea tags directly) — needs a rebuild + fresh extraction to confirm
> it actually produces distinct, meaningful tags per idea.

---

## The issue

Every `IdeaNode` extracted from a transcript was showing the **exact same tag set** — both the
`d:` domain tags and the green LLM-derived "content" tags — regardless of what the idea was
actually about. Two ideas about completely different things ("Avoid over-engineering your tools"
vs. "Use a cloud MD file to steer the model") rendered with identical tag rows.

## Root causes

Found in `extractKnowledgeFromTranscript` (`packages/ingestion/src/pipeline.ts`) and its
duplicate, `extractTranscriptIdeas` (`packages/skills/src/extract-transcript-ideas.ts`):

1. **`...transcriptTags` was spread onto every idea** — the full transcript-level tag set
   (manual + content + LLM tags, ~15 entries) was copied verbatim onto each idea node.
2. **`autoTag(ideaText, plainText)` matched against the whole transcript body** (tens of
   thousands of chars) instead of the idea's own (short) text — so nearly every idea matched
   the same broad `d:` domain set; the idea's own title contributed nothing.
3. **The green tags came from a single transcript-wide LLM call** — the extraction schema only
   returned one `tags: string[]` for the whole transcript, with no per-idea tag data, so any
   attempt to give ideas "their own" content tags meant guessing from a shared pool.

## Fix history (keep this — it explains why earlier "fixes" looked like they didn't work)

1. Removed `...transcriptTags` from the idea tag spread → **no visible change**. Turned out the
   running dev server was executing a **stale compiled `dist/`** (no `tsc --watch` running;
   `packages/ingestion`/`packages/skills` are pre-compiled and the server imports the built
   output, not `src/`). Confirmed via `stat` + `grep` on `dist/pipeline.js` showing the old code
   was still live. **Lesson: rebuild + restart the dev server after editing these packages** —
   `pnpm --filter @llaab/ingestion --filter @llaab/skills run build` — or changes are invisible
   no matter how correct.
2. Changed `autoTag(ideaText, plainText)` → `autoTag(ideaText, '')` and dropped the shared LLM
   tag spread → **overcorrected**: nearly every idea ended up with only `d:ingest` (sometimes
   nothing else), because `AUTO_TAG_PATTERNS` (`packages/core/src/taxonomy.ts`) requires fairly
   specific technical keywords that short idea titles in plain prose rarely contain.
3. Tried a word-overlap heuristic (`selectRelevantContentTags`) to backfill a relevant subset of
   the transcript's shared content tags per idea — **superseded** before being verified; it no
   longer exists in `src/` (only stale references remain in `dist/*.d.ts`, itself another
   instance of the stale-build trap worth noting).

## Current fix: ask the LLM for per-idea tags directly (the structurally correct approach)

The extraction schema and prompt were changed so the LLM returns tags **per idea**, not just
once for the whole transcript:

- `ExtractedIdea` (`packages/ingestion/src/extract/llm-extract.ts:15-18`) is now
  `{ title: string; tags: string[] }`, validated by `ExtractedIdeaSchema` (accepts either a bare
  string, normalized to `{ title, tags: [] }`, or an object — backward compatible with older
  cached/chunked responses).
- `EXTRACTION_SYSTEM_PROMPT` (same file, ~line 57-59) now instructs: _"ideas: array of distinct
  insights... Each item must be an object with: title... tags: 1–3 concise topic tags that apply
  to this idea only"_.
- `normalizeExtractedIdeas` slugifies/dedupes each idea's own `tags` via `normalizeContentTags`.
- `extractKnowledgeFromTranscript` (`pipeline.ts:374-381`) and `extractTranscriptIdeas`
  (`extract-transcript-ideas.ts:36-42`) now compose idea tags as:
  `d:ingest` + manual tags + `autoTag(idea.title, '')` + `idea.tags` (the LLM's own per-idea tags)
  — no more spreading the transcript-wide tag set or heuristic backfilling.

This is the structurally correct fix (the LLM has full context on each idea and can name its own
topics) rather than reverse-engineering relevance from a shared pool after the fact.

## How to verify

1. **Rebuild before testing** — this step was missed twice already:

   ```sh
   pnpm --filter @llaab/ingestion --filter @llaab/skills run build
   ```

   then restart the Astro dev server so it picks up the new `dist/` output.

2. Clear out any leftover `idea.*` nodes from earlier failed/partial extraction attempts —
   filename collisions can abort a re-extraction partway through and leave stale, identically
   -tagged nodes mixed in with fresh ones (easy to mistake for "the fix didn't work").
3. Re-extract a transcript and confirm: different ideas show **different**, idea-specific green
   tag sets that plausibly relate to their own title (not the full transcript set, and not empty).
4. Run `pnpm --filter @llaab/ingestion --filter @llaab/skills test` — `pipeline.test.ts` and
   `extract-transcript-ideas.test.ts` both assert the new per-idea tag composition.

## If this still isn't good enough

The LLM may still produce tags that overlap heavily across ideas in a single transcript (its own
phrasing bias) or omit tags for short/thin ideas. If that shows up after a real test, the next
lever is prompt tuning — explicitly instruct the model to make each idea's tags _distinct_ from
its siblings — rather than reverting to post-hoc heuristics on a shared pool.
