# TTS Playback & Preloading

📅 Jul 30, 2026

Client-side text-to-speech via Kokoro (`kokoro-js`, WebGPU). Implementation lives in
[`apps/client/src/components/TtsPlayer/`](/apps/client/src/components/TtsPlayer/):
`TtsPlayer.tsx` (the React component/controls), `tts-player.engine.ts` (module-level synthesis
engine), `tts-player.worker.ts` (the Kokoro worker), `tts-player.utils.ts` (text normalization/
chunking).

This doc covers the **preload architecture** — how to get audio to start instantly on a user
action instead of after a multi-second cold synthesis. Written up after fixing exactly this for
the `/interviews` quiz (see `.agents/handoff.md` § Interview Quiz Module and
`.agents/memory.md` session 2026-07-30).

---

## The failure mode this fixes

A naive `TtsPlayer` keeps its worker, `AudioContext`, and audio cache **inside the component
instance**. That works fine for a single long-lived player (a transcript detail page), but breaks
badly anywhere the player is recreated per item — e.g. the interview quiz mounts a fresh
`TtsPlayer` per question via `key={question.id}`.

Symptoms when state is per-instance:

- **Preloading does nothing.** Calling `.preload()` ahead of time, then unmounting that component
  before the user needs the audio (which is the whole point of preloading — you preload the
  _next_ thing while showing the _current_ one) cancels the in-flight synthesis and deletes the
  cache entry it was building. The work is thrown away exactly when it was about to be needed.
- **The model reloads on every item.** Each instance spins up its own `Worker`, so Kokoro
  re-initializes per question/section instead of staying warm.
- **Extra `resume()` latency.** Each instance owns its own `AudioContext`, suspended on stop, so
  autoplay pays a `resume()` round-trip outside the triggering click.

None of this shows up in a quick manual test with one long transcript — it only appears once
players are created and destroyed in a loop, which is why it's easy to ship.

## The fix: a module-level synthesis engine

`tts-player.engine.ts` owns the state that must outlive any single component:

- **One shared `Worker`** (`getSharedWorker()`) — the Kokoro model loads once and stays warm for
  the lifetime of the page, not per player instance.
- **One shared `AudioContext`** (`getSharedTtsAudioContext()`) — never closed, only
  suspended/resumed for pause.
- **A job queue keyed by content** (`sections` + `voice` + `speed` + `dtype` + `device` → a stable
  cache key). One synthesis job runs at a time; others queue.
- **Preloads are retained, not owned.** `retainTtsAudio(params)` increments a retain count on the
  job; unmounting the component that requested it does **not** cancel the job. Only
  `streamTtsAudio`'s listener-based subscriptions get cancelled when their last listener
  disconnects _and_ nothing else retained the work.
- **Playback joins in-flight preloads.** `streamTtsAudio(params, listener)` looks up the existing
  job for that cache key (if any), replays chunks already decoded, and streams the rest as they
  arrive — it never starts a second synthesis run for the same content.
- **Chunks stream out of order-safe by construction.** Decoding is chained (not run in parallel
  `Promise.all`), so listeners always see chunks in synthesis order even if a later chunk happens
  to decode faster than an earlier one.

`TtsPlayer.tsx` is now a thin consumer: `.preload()` calls `retainTtsAudio`, playback calls
`streamTtsAudio` and checks `getCachedTtsAudio` first for the zero-worker-touch fast path.

## Wiring a new instant-preload site

To make some UI (e.g. "Start" or "Next" in a quiz, "Play" on a card list) feel instant:

1. **Know the next item before the user acts on it.** If selection involves randomness (e.g.
   `createInterviewSessionQuestions`), compute it once and reuse the _same_ computed result for
   the actual action — don't recompute at click time, or the preloaded cache key won't match.
2. **Render a hidden hold instance and call `.preload()` on it** as soon as the next item is
   known — while the user is still looking at the current one. See `SetupView` in
   `apps/client/src/routes/interviews.tsx` for a full example: it precomputes the session's
   question list via `useMemo`, renders a `<TtsPlayer className={styles.hiddenTts} ... />` for
   just the first question, and preloads it while the user is still configuring session options.
3. **Fire independent preloads in parallel**, not chained. Chaining `a.preload().then(() =>
b.preload())` doubles the wait before the second item is ready; call both without awaiting one
   before starting the other.
4. **Unlock the shared `AudioContext` inside the triggering user gesture.** Call
   `unlockTtsAudioPlayback()` (exported from `components/TtsPlayer`) inside the click handler that
   starts the flow (e.g. the Start button's `onClick`), not inside an effect or a `setTimeout` —
   browsers require a real user gesture for the first `resume()`, and doing it lazily inside
   autoplay adds a round-trip.
5. **Scope preload memoization to what actually changes the content**, not every prop. E.g. quiz
   session selection must not re-roll when the user only changes speech rate — that would discard
   the preload of the already-shown first question.

## What preloading is _not_

The engine only ever preloads **the next item**, one hop ahead — never a whole list. For the quiz:
one preloaded stem on the setup screen, and (while viewing a question) that question's explanation
plus the next question's stem — 1–2 items, never the full session. This keeps concurrent worker
load low and avoids wasted synthesis for items the user might skip past.

## What preloading cannot fix

The Kokoro model itself (fp32 + WebGPU) still needs a one-time cold initialization per page load —
model weights fetch/decode, ONNX session creation, WebGPU shader compilation. That's real
first-audio latency (order of seconds on a cold cache) and happens once regardless of how much is
preloaded afterward. Preloading eliminates the _per-item_ penalty (previously paid on every single
question/section); it does not eliminate the _first_ cold start on page load. If that startup cost
needs to shrink further, the lever is `dtype` (`q8`/`fp16` initialize faster than `fp32` at some
quality cost) — not preloading.

## Tests

`apps/client/src/components/TtsPlayer/tts-player.engine.test.ts` covers the engine in isolation
with a fake `Worker`/`AudioContext`: single-worker reuse across requests, cache reuse without a
second synthesis run, chunk ordering under adversarial decode timing, a retained preload
surviving its requester's unmount, playback joining an in-flight preload, late-subscriber replay
of already-decoded chunks, cancellation when nothing wants the work anymore, and error
propagation without caching a partial result.
