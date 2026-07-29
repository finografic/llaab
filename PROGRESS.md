# Interview Quiz Module: progress

Last updated: 2026-07-29T21:40:00+10:00
Last worked by: Opus, via subagent

## Status

- [x] P0 Scaffold, types, validator (SONNET)
- [ ] P1a Bank: testing (OPUS) 0/30
- [ ] P1b Bank: apis (OPUS) 0/30
- [x] P1c Bank: platform (OPUS) 32/32
- [ ] P1d Bank: typescript (SONNET) 0/28
- [ ] P1e Bank: cloud (SONNET) 0/30
- [ ] P1f Bank: frontend (SONNET) 0/28
- [ ] P1g Bank: vald (SONNET) 0/12
- [ ] P2 Spoken fields (SONNET)
- [ ] P3 App UI and state (SONNET)
- [ ] P4 kokoro-js integration (SONNET)
- [ ] P5 Human review (JUSTIN)
- [ ] P6 Optional: spoken-answer mode (SONNET)

## Files written so far

- `apps/client/src/types/interview-quiz.types.ts` — schema types from spec section 2
- `scripts/validate-interview-bank.ts` — validator, run via `bun scripts/validate-interview-bank.ts <domain>|--all` or `pnpm validate:interview-bank`
- `vault/interviews/VALD/CV_2026_CONTENT_FINAL_V5.md` — source doc (copied in)
- `vault/interviews/VALD/VALD_Technical_Interview_Prep_V2.md` — source doc (copied in)
- `vault/interviews/VALD/VALD_Glossary_V1.md` — source doc (copied in)
- `vault/interviews/VALD/questions/platform.json` — 32 questions (11 glossary, 21 depth; 22 mcq, 10 order)
- `vault/interviews/VALD/bank/platform.md` — same 32 questions as a plain readable study doc

## Decisions made

- **Path deviation from spec.** Spec section 5 says write to `src/data/questions/<domain>.json` and `docs/bank/<domain>.md` at repo root. Justin redirected: all quiz _assets_ (generated question bank JSON + markdown fallback docs) live under `vault/interviews/VALD/questions/<domain>.json` and `vault/interviews/VALD/bank/<domain>.md` instead — vault is LLAAB's existing data layer, app code stays logic-only. Validator and types already point at the vault path.
- **Route decision (spec left open).** Chosen: `/interviews` (not `/knowledge/interviews`) since the material is not in `knowledge/`. Not yet wired into the router — deferred to P3.
- Zod not added as a new `apps/client` dependency for the validator; it uses hand-written checks instead, since this is a one-off script rather than a runtime schema.
- **P1c `platform`.** Exemplar E4 in the spec is itself a `platform` question, so it was included in the bank as `platform-012` rather than being held out as format-only. One word changed from the exemplar text: "skeptic" became "sceptic", because the Australian/British spelling rule is a hard constraint and mixed spellings inside one bank would read worse than diverging from the exemplar.
- **P1c `platform`.** No `code` blocks used in this bank. `platform` is a philosophy and judgement domain; the exemplars that carry code (E2, E6) are `testing` and `typescript`. Spoken variants (`stemSpoken` / `explanationSpoken`) added only where the text actually mangles under TTS (the NX acronym, and three explanations with colons or dense clauses), not blanket-applied.
- **P1c `platform`.** Sub-theme coverage: 14 of 32 questions sit on the "adoption and influence" sub-theme (spec floor is 8). Four questions have an explicitly abstract or human correct answer with technically sophisticated distractors (spec floor is 3): `platform-022`, `platform-023`, `platform-024`, `platform-030`.

## Open questions for Justin

- None blocking. Confirm `/interviews` as the route name when P3 starts, or say otherwise.

## Next action

Run phase P1b (bank: `apis`) on Opus, same procedure as P1c. Read `.agents/INTERVIEW_QUIZ_APP_SPEC.md` section 1 (domain D4) and section 4 exemplars (E1 especially, which is an `apis` question) in full first. Generate 28-35 questions per the schema in section 2, writing rules in section 3. Note the D4 requirement of at least four idempotency questions from different angles, and the pronunciation gloss "eye dem po ten see" in one explanation. Ingest only the three source docs in `vault/interviews/VALD/` (CV, prep doc, glossary), no web search except to verify a specific technical fact. Write `vault/interviews/VALD/questions/apis.json` and `vault/interviews/VALD/bank/apis.md` (plain readable: question, options, correct answer, explanation, no app code needed to read it). Run `bun scripts/validate-interview-bank.ts apis` from repo root and fix every reported error before proceeding. Then update this file's Status/Files/Decisions and commit (bank files from the nested `vault/` repo, PROGRESS.md from the parent repo). Priority order per `BUILD_PHASES_AND_HANDOFF.md` is platform, then apis, then testing, so after `apis` do `testing` (P1a). Stop and report after each one.
