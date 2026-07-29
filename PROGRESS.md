# Interview Quiz Module: progress

Last updated: 2026-07-30T00:40:00+10:00
Last worked by: Opus, via subagent

## Status

- [x] P0 Scaffold, types, validator (SONNET)
- [x] P1a Bank: testing (OPUS) 35/35
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
- `vault/interviews/VALD/questions/testing.json` — 35 questions (11 glossary, 24 depth; 25 mcq, 10 order; 10 code blocks)
- `vault/interviews/VALD/bank/testing.md` — same 35 questions as a plain readable study doc

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

- **P1a `testing`.** Exemplar E2 in the spec is itself a `testing` question, so it was included in the bank rather than held out as format-only, matching the calls made for E4 in `platform` and E1 in `apis`. Its id moved from the spec's `testing-011` to `testing-012` so ids stay sequential across the glossary and depth split; stem, code, options, `distractorNotes` and `explanation` are verbatim. An `explanationSpoken` was added, because the exemplar's written explanation contains an inline code expression that must never reach kokoro.
- **P1a `testing`.** 35 questions, the top of the 28 to 35 range, split 11 glossary / 24 depth. The Playwright half is treated as a teaching surface per spec section 1 D1, so it carries all 10 code blocks and the depth section runs slightly above the spec's soft 18 to 23 guide.
- **P1a `testing`.** Every Playwright snippet was verified against the official Playwright documentation rather than written from memory, since this is a stated factual gap and a wrong snippet would be memorised as correct. Verified: `route.fulfill({ json })`; the setup-project `dependencies` pattern with `page.context().storageState({ path })` and `test.use({ storageState })`; `trace: 'on-first-retry'` plus `npx playwright show-trace`; `toHaveScreenshot` on both page and locator plus `--update-snapshots`. Nothing was left uncertain, so no snippet is flagged as doubtful.
- **P1a `testing`.** One planned glossary question (a plain "what is a locator" definition) was cut, because `testing-014` already teaches locator laziness and re-resolution with code and a definitional duplicate would have pushed the bank past 35.
- **P1a `testing`.** The markdown study doc is generated from the JSON rather than hand-written, so the two files cannot drift. Section headings and the `[x]` convention match `platform.md` and `apis.md`.

## Open questions for Justin

- None blocking. Confirm `/interviews` as the route name when P3 starts, or say otherwise.

## Next action

**All three Opus-priority phases are now complete.** `platform` (32), `apis` (35) and `testing` (35) are written, validated and committed: 102 questions across the three domains that carry the most interview weight and that were hardest to get right without a frontier model.

Per `BUILD_PHASES_AND_HANDOFF.md`, the remaining phases in order are:

- **P1d Bank: `typescript`** (Sonnet, with an Opus review pass over the difficulty-3 items, where the distractors have to be genuinely tempting).
- **P1e Bank: `cloud`** (Sonnet).
- **P1f Bank: `frontend`** (Sonnet).
- **P1g Bank: `vald`** (Sonnet; small, 10 to 15 flashcard items, all MCQ, all glossary).
- **P2 Spoken fields** (Sonnet). Largely handled inline per domain already, since `platform`, `apis` and `testing` all carry `stemSpoken` / `explanationSpoken` wherever the text mangles under TTS. Verify what is actually left rather than assuming it is a full pass.
- **P3 App UI and state** (Sonnet).
- **P4 kokoro-js integration** (Sonnet).
- **P5 Human review** (Justin).

**A natural pause point exists here.** Three of the highest-value, hardest-to-verify banks are done, and every one of them is readable as plain markdown at `vault/interviews/VALD/bank/*.md` with no app, no build step and no network. If nothing else gets built before Friday, the material still works: open the markdown, read the stem, cover the answers. Per spec section 7, time spent saying answers out loud beats time spent building the tool that asks them.
