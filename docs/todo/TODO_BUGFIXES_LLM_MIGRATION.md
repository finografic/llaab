# TODO — Bugfixes found during LLM transport migration

> Discovered by Claude Fable 5 while migrating `@llaab/llm` to the Vercel AI SDK
> (`codex/fable-ai-sdk-migration-setup`, see `docs/todo/TODO_FABLE_MIGRATION_LEDGER.md`).
> Correctly left untouched at the time — out of scope for a transport migration whose brief
> required behaviour-preserving changes only. Filed here so they don't get lost.
>
> Not included: the 4 pre-existing `wiki.schema.test.ts` /
> `vault-wiki-drafts.routes.test.ts` failures — those are already assigned separately.

---

## 1. `resolveModel` provider override is inert (P1 — real bug)

**File:** `packages/llm/src/router.ts`

**What's wrong:** the function that resolves which provider/model to use for a task has a
ternary intended to let a caller override the provider. Both branches of that ternary currently
resolve to the same value — an override never actually changes the provider, only (at most) the
model string within whatever provider was already selected.

**Why it matters:** any `LLAAB_*_MODEL` env override — or any future caller-supplied override —
that is meant to redirect a task to a different provider (e.g. force `extract` from OpenCode to
Anthropic) silently does nothing. The model name may appear to change while the provider does
not, which is confusing to debug because nothing errors.

**Current state:** the inert behaviour is pinned by a passing test in `router.contract.test.ts` —
that test currently asserts the _bug's_ behaviour, not the intended behaviour. Fixing this
requires updating that test's expectation, which is legitimate here (the test was written to pin
current-not-necessarily-correct behaviour during the migration, not to encode a requirement).

**Acceptance criteria:**

- [x] Confirm the intended behaviour: should a provider override in an env var or call-site option
      change the resolved provider, the resolved model, or both? (Check callers and any existing
      docs/comments for original intent before assuming.)
      → **Resolved:** `LLAAB_*_MODEL` env vars were never involved in this bug — they only set
      per-tier model strings baked into `DEFAULT_ROUTING` at module load and never touch
      `resolveModel`'s `override` param. The actual affected surface is the ad-hoc
      `override?: string` accepted by `routeLlm`/`streamLlm`/`routeLlmObject`/`resolveLlmRoute`/
      `invalidateLlmCache`. The codebase already has a working convention for encoding
      provider+model together as a single string — `LlmRoutingEditor.tsx` builds/parses
      `` `${provider}:${model}` `` for persisted routing selections. Adopted the same convention
      for the ad-hoc override: a `provider:model` string (where the prefix is a recognized
      `LlmProviderId`) redirects the provider; a bare model string (no colon, or a colon that
      isn't a valid provider prefix — e.g. real Ollama tags like `gemma4:e4b-it-qat`) keeps the
      routed provider, exactly as before. Backward compatible for every existing bare-model
      override.
- [x] Fix the ternary so both branches are reachable and distinct.
      → `resolveModel` now calls a new `parseModelOverride()` helper and picks
      `parsedOverride?.provider ?? route.provider`.
- [x] Update `router.contract.test.ts` to assert correct behaviour; add a case for each branch.
      → Replaced the single "current behaviour" test with three: bare override keeps provider,
      `provider:model` override redirects it, and a colon-bearing-but-unrecognized-prefix model
      name (`gemma4:e4b-it-qat`) stays bare. Same pattern applied to `resolveLlmRoute`'s test.
- [x] Grep for any code or docs that currently work around this (e.g. an env var that's set but
      known not to work) and reconcile.
      → Found the real-world manifestation: `getConsolidationConfig` in
      `apps/server/src/routes/vault/vault-transcripts.routes.ts` ("fast" consolidation mode)
      passed `resolveLlmRoute('extract').model` as a bare `modelOverride` into a `consolidate`
      task call — intending to borrow extract's (cheaper/faster) model, but silently keeping
      consolidate's provider whenever the two tasks are routed to different providers. Fixed to
      pass `` `${extractRoute.provider}:${extractRoute.model}` ``. This also makes the
      `consolidationRoute` telemetry reported via `setRunLlmTrace` (line ~752, same file)
      accurate for "fast" mode, since it resolves through the same fixed function.
- [x] Full `packages/llm` suite green; full-workspace `pnpm typecheck` unaffected (this is an
      internal-only change, no exported signature involved).
      → `pnpm exec vitest run packages/llm`: 127 passing (was 125; +2 new branch cases net of the
      1 replaced test). `pnpm typecheck` / `pnpm build` green workspace-wide.

**Status: done.**

---

## 2. Cache key excludes `system`/`maxTokens`, and writes happen even under `bypassCache` (P2 — latent correctness issue)

**File:** `packages/llm` cache layer (`cacheSet`/`cacheGet` and whatever derives the cache key —
check `ai-sdk-model-registry.ts` and the router for where the key is built).

**What's wrong, in two parts:**

1. The cache key is derived without including `system` or `maxTokens`. Two calls with the same
   user prompt but a different system instruction, or a different token cap, currently collide in
   the cache — one call's response can be served back for the other.
2. `cacheSet` still writes to the cache even when the caller passed `bypassCache: true`. Bypass
   currently means "don't _read_ from cache," not "don't touch the cache at all" — which is a
   defensible design, but combined with (1) it means a bypassed call can silently poison the
   cache for a later non-bypassed call with a different `system`/`maxTokens`.

**Why it matters:** this is the kind of bug that doesn't show up in testing — it shows up months
later as "why did this task get a response that doesn't match its system prompt," and it will be
very hard to trace back to the cache once it happens.

**Current state:** pinned as current behaviour by A0 characterization tests (not changed during
the migration, per scope discipline). Not a regression — this predates the AI SDK migration.

**Acceptance criteria:**

- [x] Decide the correct cache key shape: almost certainly needs to include a hash of `system` and
      `maxTokens` alongside whatever it already includes (task, model, prompt).
      → Added `buildCacheKeyContext(providerId, model, system?, maxTokens?)` in `router.ts`,
      returning `` `${providerId}:${model}:${system ?? ''}:${maxTokens ?? ''}` ``. `cache.ts`
      itself is unchanged — it already just hashes whatever "model" string it's handed
      (`` `${model}:${prompt}` `` → sha256), so this is a router-side change only: the composite
      string passed as that "model" argument now carries system/maxTokens too.
- [x] Decide the correct `bypassCache` semantic: recommend bypass should skip both read _and_
      write, so a bypassed call never mutates cache state a future non-bypassed call could
      inherit. Confirm no caller relies on the current write-through-on-bypass behaviour before
      changing it (grep call sites).
      → Confirmed no caller relies on it — quite the opposite. The one cacheable-task caller that
      passes `bypassCache: true` (`packages/ingestion/src/extract/llm-extract.ts`, task
      `extract`) was working _around_ the old bug: on a JSON-parse failure it explicitly calls
      `invalidateLlmCache('extract', prompt, prepared.model)` to clean up the very entry the
      bypassed call had just (incorrectly) written. Every other `bypassCache: true` caller targets
      non-cacheable tasks (`wiki-compile`/`wiki-discover`/`wiki-link`/`consolidate`), so the write
      behaviour never mattered there either way. Changed `routeLlm` to gate both the read and the
      write on the same `cacheable` boolean.
- [x] Update or add cache tests to assert: (a) differing `system` → different cache entries;
      (b) differing `maxTokens` → different cache entries; (c) `bypassCache: true` never writes.
      → All three added/updated in `router.contract.test.ts`. (a)/(b) replace the old
      "ignores system and maxTokens" test (inverted — same values now hit, different values now
      miss). (c) rewrote "bypassCache skips the cache read but still writes" into "...skips both
      the cache read and the write" — a subsequent non-bypassed call now sees the _original_
      cached value, not the bypassed call's response.
- [x] Full `packages/llm` suite green; confirm the 24h TTL and existing cache-hit tests still pass
      unmodified (only the key derivation and bypass-write behaviour should change).
      → `pnpm exec vitest run packages/llm`: 127 passing. `cache.test.ts` (TTL/key-derivation unit
      tests against the unchanged `cache.ts` module) untouched and green. Full-workspace
      `pnpm typecheck` / `pnpm build` green.

**Note:** `invalidateLlmCache`'s public signature (`task, prompt, override?`) still has no way to
know what `system`/`maxTokens` a call used, so it can only evict the entry cached for a call made
_without_ those — documented as a code comment on the function. Its one real caller
(`llm-extract.ts`) always passes `bypassCache: true`, which since this fix never writes an entry
to evict in the first place, so this is now a no-op there (harmless — left in place rather than
removed, since it's still meaningful for any future non-bypassed cacheable-task caller without a
system prompt).

**Status: done.**

---

## 3. Anthropic retry/backoff on 408/429/5xx — verify, not necessarily fix (P2 — needs a decision)

**Context:** the migration pins AI SDK transport retries to 0 (`maxRetries: 0`) because the SDK's
default retry behaviour would multiply LLAAB's own semantic retries at the task level. That's the
right call _if_ every call path that can hit a transient error (rate limit, timeout, 5xx) already
has an app-level retry above the transport. This item is to confirm that assumption, not
necessarily to write new code.

**Acceptance criteria:**

- [x] Enumerate every call site that reaches the Anthropic transport directly or via
      `routeLlm`/`routeLlmObject`, and confirm each either (a) has an existing semantic retry
      (e.g. the extraction/consolidation auto-retry-on-quality-check path), or (b) is a context
      where a hard, immediate failure on a transient 429/5xx is actually the desired behaviour.

→ All 9 non-test call sites of `routeLlm`/`streamLlm`/`routeLlmObject` enumerated:

| Call site                                                                                                           | Task            | Retry coverage                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ingestion/src/extract/llm-extract.ts`                                                                     | `extract`       | **(a)** — wrapped in `@llaab/control`'s `execute()` with `onFailure: 'retry'`. Confirmed by reading `orchestrator.ts`: `input.run(...)` is inside the `try` block, so _any_ thrown error (transport included) is caught and retried up to `policy.maxRetries`, not just schema-validation failures. Fully covered.                                                                                                                                                                 |
| `apps/server/src/routes/vault/vault-transcripts.routes.ts` (`callLlmForJson`, used by canonical-idea consolidation) | `consolidate`   | **Gap.** `const llm = await routeLlm(...)` sits _outside_ the `try` block that catches parse/schema failures for its 2-attempt retry loop — a transport error (429/5xx/network) throws straight out of the loop on attempt 1, skipping the retry entirely. Filed below as item 3a.                                                                                                                                                                                                 |
| `packages/skills/src/wiki/compile-wiki-draft.ts`                                                                    | `wiki-compile`  | **Gap.** Its one retry is gated by `isFixableWikiCompileFailure()`, whose `FIXABLE_ERROR_PATTERNS` only match JSON/schema-shaped messages (`malformed or truncated json`, `unknown source ref`, `invalid_type\|expected\|required`, etc.) — no pattern matches a transport error message (`"OpenCode request failed: 503 ..."`, `"LM Studio request failed: 500 ..."`). A transient transport failure on the first attempt aborts compilation immediately. Filed below as item 3b. |
| `packages/skills/src/wiki/discover-transcript-wiki-topics.ts`                                                       | `wiki-discover` | **(b)** — no retry, but only reachable via `discoverTranscriptWikiTopics()` → `apps/server/.../wiki-draft-generation.service.ts` → `runSkill(...)`. A throw fails the RunNode; wiki creation is an explicit user-triggered action (per "One-Step Wiki Creation") the user can re-trigger. Acceptable.                                                                                                                                                                              |
| `packages/skills/src/wiki/discover-wiki-candidates.ts`                                                              | `wiki-discover` | **(b)** — same reasoning as above; part of the same manually-triggered discovery flow.                                                                                                                                                                                                                                                                                                                                                                                             |
| `packages/skills/src/wiki/link-wiki-topics.ts`                                                                      | `wiki-link`     | **(b)** — the whole `routeLlm` call is inside a `try/catch` that treats _any_ failure (transport or parse) as "wiki-link skipped: `<message>`" and degrades gracefully with `attempted: true`. Wiki-link is explicitly optional/best-effort. No retry needed by design.                                                                                                                                                                                                            |
| `apps/server/src/commands/llm-command.handler.ts` (`ai.run` terminal command)                                       | any             | **(b)** — an interactive, single-shot, user-watched command (Terminal Panel). Hard-fail-and-let-the-user-retype is the correct UX; nothing to change.                                                                                                                                                                                                                                                                                                                              |
| `apps/server/src/routes/llm/llm.routes.ts` (`/api/llm/complete`, `/api/llm/stream`)                                 | any             | **(b)** — the `/llm` page's direct test/debug endpoints, same interactive reasoning as above.                                                                                                                                                                                                                                                                                                                                                                                      |

- [x] For any call site with neither — decide whether it needs its own retry wrapper, and if so,
      file that as a separate follow-up rather than doing it inline here.
      → Filed as items 3a and 3b below. Not fixed inline — both require judgment calls (retry
      count, which errors are worth retrying vs. failing fast) that belong in their own reviewed
      change, not bundled into this bugfix pass.
- [x] No code change required if everything is already covered — document the finding in this
      file or close it out with a one-line note.
      → Not fully covered — 2 real gaps found and filed immediately below.

**Status: done (verification complete; 2 gaps filed as follow-ups, not fixed here).**

---

### 3a. `callLlmForJson` (consolidation) doesn't retry transport errors — only parse/schema failures

**File:** `apps/server/src/routes/vault/vault-transcripts.routes.ts`, function `callLlmForJson`
(~line 288).

**What's wrong:** the 2-attempt retry loop wraps only `schema.parse(parseJsonFromLlmText(llm.text))`
in `try/catch`. The `const llm = await routeLlm(task, input, {...})` call that precedes it is
outside that `try` — a transport-level throw (rate limit, 5xx, network) propagates immediately out
of the loop on the first attempt, so canonical-idea consolidation gets zero resilience against a
transient failure even though the function's own shape (a `for` loop with an `attempts` parameter)
suggests it was meant to retry the whole call, not just the parse step.

**Acceptance criteria:**

- [ ] Move the `routeLlm` call inside the existing `try` block (or wrap it separately) so a
      transport-level throw on attempt N < `attempts` triggers the same retry path as a
      parse/schema failure, rather than aborting the loop.
- [ ] Decide whether _all_ transport errors should be retried, or only ones that look transient
      (this repo already has a `mapOpenCodeError`/`mapLmStudioError`-style pattern in
      `packages/llm` that turns HTTP status codes into typed messages — consider whether a status
      code is available to gate on here, or whether retrying blindly for 2 attempts is acceptable
      given consolidation is already a background/manual-retry-able run).
- [ ] Add a test exercising `callLlmForJson` (or `consolidateTranscriptIdeasForTranscript`) where
      the first `routeLlm` call rejects and the second succeeds, asserting the run still completes.
- [ ] Full `apps/server` suite green.

---

### 3b. `compile-wiki-draft.ts` retry gate doesn't recognize transport-error messages

**File:** `packages/skills/src/wiki/compile-wiki-draft.ts` (retry logic ~line 594) and
`packages/skills/src/wiki/wiki-compile-coherence.utils.ts` (`isFixableWikiCompileFailure`,
`FIXABLE_ERROR_PATTERNS`, ~line 221).

**What's wrong:** `FIXABLE_ERROR_PATTERNS` is an intentional allowlist of JSON/schema-shaped
failure messages that are worth a single retry with an amended prompt. It has no pattern for a raw
transport failure message, so a transient `OpenCode request failed: 503 ...` /
`LM Studio request failed: 500 ...` / network `TypeError` on the first `compileAttempt()` call is
treated as terminal — wiki compilation fails outright instead of getting the same one-retry
courtesy a malformed-JSON response gets.

**Acceptance criteria:**

- [ ] Decide whether transport errors deserve the _same_ retry path as fixable validation
      failures, or a separate one (the current retry re-prompts the model with
      `"Fix invalid output or validation issues: ${firstFailure}"`, which makes no sense to send
      back to the model for a transport failure — a transport retry should just re-issue the same
      request, not append a "fix this" instruction).
- [ ] If a transport retry is added, keep it a single retry (matching the existing one-retry
      ceiling here) rather than introducing unbounded retry — this is exactly the
      retry-multiplication risk the AI SDK migration's `AI_SDK_MAX_RETRIES = 0` was set to avoid,
      so any new retry here must stay a deliberate, capped, application-level decision.
- [ ] Add a test where `compileAttempt` rejects with a transport-shaped error message on the first
      call and succeeds on the second, asserting compilation still completes.
- [ ] Full `packages/skills` suite green.

---

## 4. Unprotected areas flagged in the migration ledger — spot-check when convenient (P3 — no known bug, just no test coverage)

These aren't confirmed bugs — they're areas the A0 characterization tests didn't cover, called
out explicitly in the ledger's Risks & Landmines so they don't get assumed-safe by default:

- [x] Legacy `summarizeText` (`client.ts`) — not exercised by A0.
      → Spot-checked: straightforward provider dispatcher, no logic bug found. **It has zero
      remaining callers anywhere in the workspace** (`grep` for `summarizeText` outside its own
      definition/barrel export in `packages/llm/src/{client,index}.ts` returns nothing) — it's
      dead public API, not a bug. Not removed here (removing a public export is a scope decision
      for the maintainer, not a bugfix); noting it so it doesn't get assumed load-bearing.
- [x] `cloud-model-catalog.ts` resolution/persistence — not exercised by A0.
      → Spot-checked the full file (`readCatalogFile`/`writeCatalogFile`/TTL/refresh/fallback
      logic). No correctness bug found. Minor observation only: `availabilityForSource`'s
      `source === 'config'` branch and its fallback branch both resolve to
      `hasApiKey ? 'catalog' : 'on-request'` — functionally redundant but not incorrect (both
      branches already produce the same result), so not worth a change.
- [ ] LM Studio progress-poll internals (`lms ps` line-parsing regex, 2.5s cadence, duplicate
      suppression) — only the `onProgress` lifecycle and stop-on-error are pinned by tests. Not
      spot-checked this pass — no reported symptom to chase, and it needs a live `lms` process to
      exercise meaningfully rather than a desk check.
- [ ] Real `AbortSignal.timeout` / `execFile` timeout firing — only the requested millisecond
      values are pinned, not that a timeout actually fires and is handled correctly under load.
      Not spot-checked — same reasoning, needs live infra under load to be meaningful.
- [ ] Live wire formats for all three remote providers — fixtures encode _assumed_ shapes; worth a
      watchful eye on the first live calls after this migration (see the ledger's manual-test list).
      Still open — this needs real API traffic, not a code read.

No action required unless a spot-check turns up a real issue — if one does, split it into its own
item above with acceptance criteria. (Two items above were spot-checked with no bug found; the
remaining three need live traffic/infra to meaningfully check and are left for the manual-test
pass already tracked in the migration ledger.)

---

## Suggested order

1 (provider override) is the highest-value fix and fully self-contained — good first pick.
2 (cache key/bypass) is the next most important; it's a correctness issue that will eventually
cause a confusing bug report if left alone. 3 is a verification task, likely closes with no code
change. 4 is opportunistic — only worth time if something in the manual-test pass (from the
migration ledger) actually surfaces a problem in one of these areas.
