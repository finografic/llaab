# AGENTS.md — Vault Routes

This folder contains the vault HTTP routes, organised by domain into separate
`vault-*.routes.ts` files. `vault.routes.ts` is a re-export barrel — it exists
only so `index.ts` can keep a single `import * as routes from './vault.routes.js'`.

## File map

| File                          | Domain           | Exports                                                                                                                                           |
| ----------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vault-auth.routes.ts`        | Auth             | `vaultAuthLogin`, `vaultAuthLogout`, `vaultAuthSession`                                                                                           |
| `vault-git.routes.ts`         | Git status       | `vaultGitStatus`, `vaultGitCommit`                                                                                                                |
| `vault-nodes.routes.ts`       | Node CRUD        | `vaultTree`, `cleanRecent`, `file`, `listVaultNodes`, `createVaultNode`, `nodeDetail`, `nodeRaw`                                                  |
| `vault-transcripts.routes.ts` | Transcripts      | `transcriptIdeas`, `extractTranscript`, `consolidateTranscriptIdeas`, `resolveCanonicalIdeaConflict`, `promoteCanonicalIdea`, `discardTranscript` |
| `vault-runs.routes.ts`        | Runs             | `deleteRun`, `previewDeleteRuns`                                                                                                                  |
| `vault-sources.routes.ts`     | Sources          | `enrichSource`, `updateSourceProfiles`                                                                                                            |
| `vault.routes.ts`             | Re-export barrel | re-exports all of the above                                                                                                                       |

`vault.schema.ts` — Zod schemas and inferred types for all request bodies / queries.
`index.ts` — wires the router; imports schemas and `* as routes from './vault.routes.js'`.

---

## Adding a new route file

Follow this checklist when a domain grows large enough to warrant its own file, or
when an entirely new domain arrives (e.g. `vault-tags.routes.ts`):

1. **Create `vault-<domain>.routes.ts`** in this folder.
   - Name the file after the resource / domain in kebab-case.
   - Export each route as a named `const` with a `path` and `handler` property,
     identical to the existing pattern:

     ```ts
     export const myRoute = {
       path: '/resource/:id/action' as const,
       handler: async (c: AppCtx) => { … },
     };
     ```

   - Keep private helpers (types, utilities, prompt builders) in the same file
     unless they are shared across multiple route files — in that case extract to
     a `vault-<domain>.helpers.ts` or `vault-<domain>.lib.ts` sibling.

2. **Add schemas to `vault.schema.ts`** if the route validates a request body or
   query string. Export both the Zod schema (`*Schema`) and the inferred type.

3. **Re-export from `vault.routes.ts`**:

   ```ts
   export * from './vault-<domain>.routes.js';
   ```

   This is the only change needed in `vault.routes.ts`.

4. **Wire the route in `index.ts`** using the same `routes.*` pattern:

   ```ts
   .get(routes.myRoute.path, routes.myRoute.handler)
   // or with a validator:
   .post(routes.myRoute.path, zValidator('json', myRouteBodySchema), routes.myRoute.handler)
   ```

   Import any new schema from `./vault.schema.js` at the top of `index.ts`.

5. **Update this AGENTS.md** — add a row to the file map table.

---

## Canonical idea consolidation

The full technical reference for this process — pipeline diagrams, modes (`fast` / `single-26b`),
consolidation input and output shapes, prompt rules, quality validation/scoring, tag/coverage-notes
post-processing, and the coverage model — lives in `docs/08_CANONICAL_IDEA_CONSOLIDATION.md`.

**Read it before changing anything related to consolidation.**

Relevant code:

- `vault-transcripts.routes.ts` — `consolidateTranscriptIdeas` handler,
  schemas (`CanonicalIdeaDraftSchema`, `CanonicalDraftResultSchema`, `PossibleMissedIdeaSchema`),
  mode resolution (`getConsolidationConfig`), prompt builders
  (`buildCanonicalDraftSystemPrompt`, `buildCanonicalCompactSystemPrompt`),
  the `callLlmForJson` retry helper, and post-processing
  (`sanitizeCoverageNotes`, `normalizeCanonicalTags`, `buildLegacyCoverage`).
- `packages/schemas/src/consolidation-quality.ts` — deterministic quality validation, scoring,
  and auto-retry gate after the consolidation pass.
- `packages/llm/src/types.ts`, `packages/llm/src/router.ts`, `configs/llm-routing.json` —
  `consolidate` task routing.
- `packages/schemas/src/canonical-idea-node.schema.ts`,
  `packages/schemas/src/transcript-node.schema.ts` — `CanonicalIdeaNode` and
  `canonical_coverage` shapes.

## Mandatory: keep the docs in sync

`docs/08_CANONICAL_IDEA_CONSOLIDATION.md` is the source of truth for this pipeline. Any change to
consolidation behavior MUST update that doc in the same change, including:

- Adding/removing/renaming a mode or `TaskType` (`consolidate`, ...).
- Changing the consolidation input or output shapes (`CanonicalDraftInput`, `CanonicalDraftResult`,
  `PossibleMissedIdea`, etc.) or their zod schemas.
- Changing any prompt rule (count guidance, category separation, problem/solution merge,
  context-specific, Bash-specific, typed/runtime split, single-source).
- Changing post-processing behavior (`sanitizeCoverageNotes` banned phrases/fallback,
  `normalizeCanonicalTags` aliases/limits).
- Changing quality validation/scoring (`validateConsolidationQuality`, `scoreConsolidationQuality`).
- Changing the `canonical_coverage` shape, the `coverageAudit` response shape, or default
  model routing for `consolidate`.

If a mermaid diagram in the doc no longer matches the implementation, update the diagram — do not
leave it stale.
