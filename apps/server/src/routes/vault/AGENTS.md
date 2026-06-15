# AGENTS.md — Vault Routes

This folder contains the vault HTTP routes (`vault.routes.ts`, `vault.schema.ts`, `index.ts`),
including **canonical idea consolidation** — the one-pass pipeline that turns extracted candidate
ideas into `canonical-idea` nodes.

## Canonical idea consolidation

The full technical reference for this process — pipeline diagram, input/output shapes, prompt
rules, tag/coverage-notes post-processing, and the coverage model — lives in
`docs/08_CANONICAL_IDEA_CONSOLIDATION.md`.

**Read it before changing anything related to consolidation.**

Relevant code:

- `apps/server/src/routes/vault/vault.routes.ts` — `consolidateTranscriptIdeas` handler,
  schemas (`CanonicalIdeaDraftSchema`, `CanonicalDraftResultSchema`, `PossibleMissedIdeaSchema`),
  prompt/input builders (`buildCanonicalSystemPrompt`, `buildCanonicalInput`), the
  `callLlmForJson` retry helper, and post-processing (`sanitizeCoverageNotes`,
  `normalizeCanonicalTags`, `buildLegacyCoverage`).
- `packages/llm/src/types.ts`, `packages/llm/src/router.ts`, `configs/llm-routing.json` —
  `consolidate` task routing.
- `packages/schemas/src/canonical-idea-node.schema.ts`,
  `packages/schemas/src/transcript-node.schema.ts` — `CanonicalIdeaNode` and
  `canonical_coverage` shapes.

## Mandatory: keep the docs in sync

`docs/08_CANONICAL_IDEA_CONSOLIDATION.md` is the source of truth for this pipeline. Any change to
consolidation behavior MUST update that doc in the same change, including:

- Adding/removing/renaming a consolidation phase or `TaskType`.
- Changing the input or output shapes (`CanonicalInput`, `CanonicalDraftResult`,
  `PossibleMissedIdea`, etc.) or their zod schemas.
- Changing any prompt rule (count guidance, category separation, problem/solution merge,
  context-specific, Bash-specific, typed/runtime split, single-source).
- Changing post-processing behavior (`sanitizeCoverageNotes` banned phrases/fallback,
  `normalizeCanonicalTags` aliases/limits).
- Changing the `canonical_coverage` shape, the legacy `coverageAudit` response shape, or default
  model routing for `consolidate`.

If a mermaid diagram in the doc no longer matches the implementation, update the diagram — do not
leave it stale.
