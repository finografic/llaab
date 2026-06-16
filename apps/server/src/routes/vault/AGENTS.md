# AGENTS.md — Vault Routes

This folder contains the vault HTTP routes (`vault.routes.ts`, `vault.schema.ts`, `index.ts`),
including **canonical idea consolidation** — the Draft + Audit pipeline that turns extracted
candidate ideas into `canonical-idea` nodes.

## Canonical idea consolidation

The full technical reference for this process — pipeline diagrams, modes (`fast` / `balanced` /
`best`), draft/audit input and output shapes, prompt rules, tag/coverage-notes post-processing,
and the coverage model — lives in `docs/08_CANONICAL_IDEA_CONSOLIDATION.md`.

**Read it before changing anything related to consolidation.**

Relevant code:

- `apps/server/src/routes/vault/vault.routes.ts` — `consolidateTranscriptIdeas` handler, draft/audit
  schemas (`CanonicalIdeaDraftSchema`, `CanonicalDraftResultSchema`, `CanonicalAuditResultSchema`,
  `PossibleMissedIdeaSchema`), mode resolution (`getConsolidationTasks`), prompt builders
  (`buildCanonicalDraftSystemPrompt`, `buildCanonicalCompactSystemPrompt`,
  `buildCanonicalAuditSystemPrompt`), the `callLlmForJson` retry helper, and post-processing
  (`sanitizeCoverageNotes`, `normalizeCanonicalTags`, `buildLegacyCoverage`).
- `packages/schemas/src/consolidation-quality.ts` — deterministic quality validation, scoring,
  and auto-retry gate after the draft pass.
- `packages/llm/src/types.ts`, `packages/llm/src/router.ts`, `configs/llm-routing.json` —
  `consolidate` / `consolidate-audit` task routing.
- `packages/schemas/src/canonical-idea-node.schema.ts`,
  `packages/schemas/src/transcript-node.schema.ts` — `CanonicalIdeaNode` and
  `canonical_coverage` shapes.

## Mandatory: keep the docs in sync

`docs/08_CANONICAL_IDEA_CONSOLIDATION.md` is the source of truth for this pipeline. Any change to
consolidation behavior MUST update that doc in the same change, including:

- Adding/removing/renaming a phase, mode, or `TaskType` (`consolidate`, `consolidate-audit`, ...).
- Changing the draft/audit input or output shapes (`CanonicalDraftInput`, `CanonicalDraftResult`,
  `CanonicalAuditInput`, `PossibleMissedIdea`, etc.) or their zod schemas.
- Changing any prompt rule (count guidance, category separation, problem/solution merge,
  context-specific, Bash-specific, typed/runtime split, single-source).
- Changing post-processing behavior (`sanitizeCoverageNotes` banned phrases/fallback,
  `normalizeCanonicalTags` aliases/limits).
- Changing the `canonical_coverage` shape, the legacy `coverageAudit` response shape, or default
  model routing for `consolidate` / `consolidate-audit`.

If a mermaid diagram in the doc no longer matches the implementation, update the diagram — do not
leave it stale.
