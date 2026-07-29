# Interview Quiz Module: progress

Last updated: 2026-07-30T02:20:00+10:00
Last worked by: Opus, via subagent

## Status

- [x] P0 Scaffold, types, validator (SONNET)
- [x] P1a Bank: testing (OPUS) 35/35
- [x] P1b Bank: apis (OPUS) 35/35
- [x] P1c Bank: platform (OPUS) 32/32
- [x] P1d Bank: typescript (OPUS) 33/33
- [ ] P1e Bank: cloud (SONNET) 0/30
- [ ] P1f Bank: frontend (SONNET) 0/28
- [x] P1g Bank: vald (OPUS) 14/14
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
- `vault/interviews/VALD/questions/typescript.json` — 33 questions (11 glossary, 22 depth; 23 mcq, 10 order; 8 code blocks)
- `vault/interviews/VALD/bank/typescript.md` — same 33 questions as a plain readable study doc
- `vault/interviews/VALD/questions/vald.json` — 14 questions (14 glossary, 0 depth; 14 mcq, 0 order)
- `vault/interviews/VALD/bank/vald.md` — same 14 questions as a plain readable study doc

## Decisions made

- **P1g `vald`, phase reordered.** Run ahead of P1e (`cloud`) and P1f (`frontend`) on Justin's explicit instruction, and at Opus rather than Sonnet. Reason: `vald` is the one bank whose content cannot be produced from general training knowledge. It needs niche, employer-specific product facts (device names, what HumanTrak actually is, what Hub and Norms are) read carefully out of the source documents, so accuracy depends on grounded reading rather than domain fluency. `cloud` and `frontend` are general-knowledge domains and are safer to run later or at a smaller model.
- **P1g `vald`.** 14 questions, inside the spec's 10 to 15 band. All `type: "mcq"`, all `section: "glossary"`, per the section 3 exemption that removes `vald` from the normal volume and mix rules. No `order` questions and no `depth` questions were written, deliberately. No `code` blocks: this is a product and terminology warm-up, not a code domain. Difficulty is 11 at level 1 and 3 at level 2 (`vald-009` device/Hub responsibility split, `vald-013` observability tooling, `vald-014` MassTransit), with no level 3, since the spec calls this a warm-up rather than a judgement domain. `distractorNotes` is therefore unused; each explanation names the tempting distractor inline instead, which is the spec's stated purpose for that field.
- **P1g `vald`. Source coverage is thinner than the phase brief assumed, and this is the one real finding.** The three source documents name six devices (ForceDecks, NordBord, ForceFrame, DynaMo, HumanTrak, SmartSpeed) in a single list, but they only ever describe those devices collectively as "hardware that measures human movement". **No source document states what any individual device measures**, with the single exception of HumanTrak (3D markerless motion tracking, 20 plus assessments, real time feedback). So the brief's "the device products VALD makes and what each measures" is only writable for HumanTrak. Per-device flashcards for ForceDecks, NordBord, ForceFrame, DynaMo and SmartSpeed were **dropped rather than written**, because every one of them would have required inventing the metric from general fitness-tech knowledge, and a wrong flashcard teaches a wrong answer (spec section 7). `vald-002` uses the device names only as options in a "which of these is the platform, not a device" identification, which is fully grounded.
- **P1g `vald`.** No invented product or brand names appear anywhere in the bank, including in distractors. Distractors are drawn from other vendors, other clouds or other architectures, never from a plausible-sounding VALD-style name, since an invented name could accidentally collide with a real VALD product not mentioned in the sources.
- **P1g `vald`.** Because the product surface is thin, the bank also covers the grounded stack facts from the prep document, which are just as much flashcard material for Friday: Hub front end (React and TypeScript), backend (C# ASP.NET Core micro-services), IaC (Bicep), observability (Application Insights, Azure Monitor, SEQ) and MassTransit over Azure Service Bus. All five are stated verbatim in `VALD_Technical_Interview_Prep_V2.md` or `VALD_Glossary_V1.md`.
- **P1g `vald`.** `stemSpoken` / `explanationSpoken` added only where TTS would mangle the text: the camel-case product names (`ForceDecks`, `NordBord`, `SmartSpeed`, `HumanTrak`, `MassTransit`), `.NET` and `ASP.NET`, `3D`, `ARM`, `SEQ` and `AWS`. Not blanket-applied, matching the calls in the earlier banks. `C#` was written as "C sharp" directly in the option text rather than via a spoken variant, since options are never read aloud but are read on screen and "C sharp" is unambiguous either way.
- **P1g `vald`.** The markdown study doc is generated from the JSON, same as the other banks, so the two cannot drift. It carries a single Glossary section because there is no depth section by design.

- **P1d `typescript`.** Exemplar E6 in the spec is itself a `typescript` question, so it was included in the bank verbatim rather than held out as format-only, matching the calls made for E4 (`platform`), E1 (`apis`) and E2 (`testing`). Its id moved from the spec's `typescript-009` to `typescript-013` so ids stay sequential across the glossary and depth split; stem, `stemSpoken`, code, options, `distractorNotes` and `explanation` are verbatim. An `explanationSpoken` was added, because the written explanation contains a backticked `as` and the camelCase field `peakForce`, neither of which should reach kokoro.
- **P1d `typescript`.** 33 questions, split 11 glossary / 22 depth, 23 mcq / 10 order (70/30). The depth section sits one above the spec's soft 18 to 23 guide because the domain has more distinct sub-topics than slots; nothing was padded to reach the number.
- **P1d `typescript`.** Ran code-heavy per spec section 1 D5: 8 of the 33 questions carry a `code` block, all in the depth section (`satisfies` versus annotation, the E6 `as` cast, a generic constraint, a `typeof` narrowing that forgets null, a lying type predicate, discriminated union versus boolean flags, a `Record` index access, and `ReturnType` with `typeof`). Difficulty is an even 11 / 11 / 11 across levels 1, 2 and 3.
- **P1d `typescript`.** `distractorNotes` are filled on all six difficulty-3 MCQs as the spec requires, plus five difficulty-2 MCQs where the near-miss option needed naming. Ordering questions carry `orderRationale` instead, per the schema.
- **P1d `typescript`.** Two order questions were reshaped rather than shipped as drafted, because their first form had an arbitrary answer. A "narrowing steps" item originally asked whether the null check or the `typeof` check comes first, which is genuinely interchangeable, and became `typescript-032` (non-null object, then discriminant present, then switch, then read fields), which is forced by what would otherwise throw. A safety-ladder item originally ranked `any` against `as`, both of which check nothing, and became `typescript-025` ranked by how much data is actually inspected at runtime.
- **P1d `typescript`.** `typescript-031` (tightening compiler settings across a monorepo) is deliberately a `platform` crossover: the correct order is evidence, then codemod, then default, then enforcement. It rehearses the adoption sequence from `platform-012` in a TypeScript costume, which is the shape of question most likely to come up given the platform-squad framing.
- **P1d `typescript`.** The markdown study doc is generated from the JSON rather than hand-written, so the two cannot drift. Headings and the `[x]` convention match `platform.md`, `apis.md` and `testing.md`.

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
- **`vald` bank, worth a look before Friday.** The source documents never say what ForceDecks, NordBord, ForceFrame, DynaMo or SmartSpeed individually measure, so the bank cannot ask. If you want per-device flashcards ("NordBord measures eccentric hamstring strength" and so on), the facts have to come from you or from VALD's own site, and then they can be added as `vald-015` onward. They were deliberately not guessed.

## Next action

**Five banks done: 149 questions.** `platform` (32), `apis` (35), `testing` (35), `typescript` (33) and the `vald` bonus round (14) are written, validated and committed. `typescript` was run at Opus quality rather than Sonnet-plus-review, since the difficulty-3 distractors are the whole point of that domain. `vald` was pulled forward out of order and also run at Opus, because it is the only bank that cannot be written from general knowledge.

**Next up: P1e Bank: `cloud`** (Sonnet). Same procedure as P1d: read the spec plus the three source docs, generate 28 to 35 questions against spec section 1 D3, write `vault/interviews/VALD/questions/cloud.json` and `vault/interviews/VALD/bank/cloud.md`, run `bun scripts/validate-interview-bank.ts cloud` until it prints `OK`, grep for em-dashes and US spellings, update this file, then commit bank files from the nested vault repo and `PROGRESS.md` from the parent repo. Spec-specific notes for `cloud`: mapping questions are a priority format, at least three of them must be about where the AWS-to-Azure mapping is _imperfect_, and Service Bus / MassTransit stay light. Exemplar E5 is a `cloud` question, so include it in the bank verbatim (renumbered to fit) as was done for E1, E2, E4 and E6.

Per `BUILD_PHASES_AND_HANDOFF.md`, the remaining phases in order are:

- **P1e Bank: `cloud`** (Sonnet).
- **P1f Bank: `frontend`** (Sonnet).
- ~~P1g Bank: `vald`~~ done, run early at Opus (see Decisions made).
- **P2 Spoken fields** (Sonnet). Largely handled inline per domain already, since `platform`, `apis` and `testing` all carry `stemSpoken` / `explanationSpoken` wherever the text mangles under TTS. Verify what is actually left rather than assuming it is a full pass.
- **P3 App UI and state** (Sonnet).
- **P4 kokoro-js integration** (Sonnet). **Do not wire up kokoro-js from scratch.** A reusable `TtsPlayer` component already exists at `apps/client/src/components/TtsPlayer/` (`TtsPlayer.tsx`, `tts-player.worker.ts`, `tts-player.types.ts`, `tts-player.utils.ts`, exported via `index.ts`) and is already in use on the wiki detail page (`apps/client/src/routes/wiki-detail-page.tsx`) and transcript detail (`apps/client/src/components/TranscriptsSplitView/components/TranscriptDetail.tsx`). Per project memory it runs Kokoro with `dtype="fp32"` + `device="webgpu"` and handles model load/caching already. P4 should reuse this component against `stemSpoken ?? stem` and `explanationSpoken ?? explanation`, not reimplement kokoro loading.
- **P5 Human review** (Justin).

**A natural pause point exists here.** Four of the highest-value, hardest-to-verify banks are done, and every one of them is readable as plain markdown at `vault/interviews/VALD/bank/*.md` with no app, no build step and no network. If nothing else gets built before Friday, the material still works: open the markdown, read the stem, cover the answers. Per spec section 7, time spent saying answers out loud beats time spent building the tool that asks them.
