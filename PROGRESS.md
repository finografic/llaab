# Interview Quiz Module: progress

Last updated: 2026-07-29T23:05:00+10:00
Last worked by: Opus, via subagent

## Status

- [x] P0 Scaffold, types, validator (SONNET)
- [ ] P1a Bank: testing (OPUS) 0/30
- [x] P1b Bank: apis (OPUS) 35/35
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
- `vault/interviews/VALD/questions/apis.json` — 35 questions (12 glossary, 23 depth; 25 mcq, 10 order)
- `vault/interviews/VALD/bank/apis.md` — same 35 questions as a plain readable study doc

## Decisions made

- **Path deviation from spec.** Spec section 5 says write to `src/data/questions/<domain>.json` and `docs/bank/<domain>.md` at repo root. Justin redirected: all quiz _assets_ (generated question bank JSON + markdown fallback docs) live under `vault/interviews/VALD/questions/<domain>.json` and `vault/interviews/VALD/bank/<domain>.md` instead — vault is LLAAB's existing data layer, app code stays logic-only. Validator and types already point at the vault path.
- **Route decision (spec left open).** Chosen: `/interviews` (not `/knowledge/interviews`) since the material is not in `knowledge/`. Not yet wired into the router — deferred to P3.
- Zod not added as a new `apps/client` dependency for the validator; it uses hand-written checks instead, since this is a one-off script rather than a runtime schema.
- **P1c `platform`.** Exemplar E4 in the spec is itself a `platform` question, so it was included in the bank as `platform-012` rather than being held out as format-only. One word changed from the exemplar text: "skeptic" became "sceptic", because the Australian/British spelling rule is a hard constraint and mixed spellings inside one bank would read worse than diverging from the exemplar.
- **P1c `platform`.** No `code` blocks used in this bank. `platform` is a philosophy and judgement domain; the exemplars that carry code (E2, E6) are `testing` and `typescript`. Spoken variants (`stemSpoken` / `explanationSpoken`) added only where the text actually mangles under TTS (the NX acronym, and three explanations with colons or dense clauses), not blanket-applied.
- **P1c `platform`.** Sub-theme coverage: 14 of 32 questions sit on the "adoption and influence" sub-theme (spec floor is 8). Four questions have an explicitly abstract or human correct answer with technically sophisticated distractors (spec floor is 3): `platform-022`, `platform-023`, `platform-024`, `platform-030`.

- **P1b `apis`.** Exemplar E1 in the spec is itself an `apis` glossary question, so it was included verbatim as `apis-001` rather than held out as format-only (same call as E4 in `platform`). Its `explanation` keeps the written pronunciation "eye-dem-POE-ten-see"; the matching `explanationSpoken` uses "eye dem po ten see" per spec section 6b.
- **P1b `apis`.** 35 questions, the top of the 28 to 35 range. Section split is 12 glossary / 23 depth; the spec's soft guide is 10 to 12 glossary and 18 to 23 depth, so this sits at the top of both bands rather than outside either.
- **P1b `apis`.** Idempotency is covered by seven questions, not the four the spec floors at: `apis-001` (definition), `apis-002` (which methods, POST the odd one out), `apis-003` (idempotent versus safe), `apis-004` (idempotency keys), `apis-013` (why offline sync and at-least-once make it mandatory), `apis-014` (idempotent versus pure), `apis-026` (server-side key handling, ordering).
- **P1b `apis`.** Two `code` blocks used (`apis-015` a TypeScript device-upload client, `apis-017` a JSON device response), both with `stemSpoken`. The domain benefits from code but most of its content is contract judgement rather than syntax, so code was used where it clarifies rather than sprayed across the bank. `explanationSpoken` is present wherever a field contains status codes read as digits, "idempotent", hyphenated header names, or acronyms; not blanket-applied.
- **P1b `apis`.** One ordering question (`apis-029`, changes ranked by breaking risk) was cut from five items to four because the fifth ordering (making an optional request field required) could not be ranked against the others without arbitrariness, and the spec says to delete an arbitrary ordering rather than defend it.

## Open questions for Justin

- None blocking. Confirm `/interviews` as the route name when P3 starts, or say otherwise.

## Next action

Run phase P1a (bank: `testing`) on Opus, same procedure as P1c and P1b. It is the last of the three Opus-priority phases (platform, then apis, then testing, per `BUILD_PHASES_AND_HANDOFF.md`). Read `.agents/INTERVIEW_QUIZ_APP_SPEC.md` section 1 (domain D1) and section 4 exemplars (E2 especially, which is a `testing` question with code) in full first. Generate 28-35 questions per the schema in section 2, writing rules in section 3. D1 has two halves: testing philosophy, and Playwright treated as a known gap where the bank should educate as well as test, with code snippets in stems and options wherever they help. Ingest only the three source docs in `vault/interviews/VALD/` (CV, prep doc, glossary), no web search except to verify a specific technical fact such as current Playwright API syntax. Write `vault/interviews/VALD/questions/testing.json` and `vault/interviews/VALD/bank/testing.md` (plain readable: question, options, correct answer, explanation, no app code needed to read it). Run `bun scripts/validate-interview-bank.ts testing` from repo root and fix every reported error before proceeding. Then update this file's Status/Files/Decisions and commit (bank files from the nested `vault/` repo, PROGRESS.md from the parent repo). Stop and report after it.
