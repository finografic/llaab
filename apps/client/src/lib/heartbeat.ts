import { useEffect, useState } from 'react';
import { subscribeWithSelector } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

// ── Singleton heartbeat store ─────────────────────────────────────────────────
// One setInterval drives the whole app — components subscribe, not poll.

interface HeartbeatState {
  tick: number;
  now: number;
}

export const heartbeatStore = createStore<HeartbeatState>()(
  subscribeWithSelector(() => ({ tick: 0, now: Date.now() })),
);

setInterval(() => {
  heartbeatStore.setState((s) => ({ tick: s.tick + 1, now: Date.now() }));
}, 1000);

// ── useElapsedSeconds ─────────────────────────────────────────────────────────
// Returns seconds elapsed since `startedAt`. Returns 0 and unsubscribes when
// `startedAt` is null (i.e. the process is not running).

export function useElapsedSeconds(startedAt: number | null): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }

    // Read from the heartbeat store, not Date.now(), for the initial value too — startedAt is
    // usually itself a heartbeatStore.now() snapshot (which only updates once per second and can
    // lag real time by up to ~999ms), so mixing time sources here produced a glitchy first tick
    // and made separate clock instances drift out of sync with each other.
    setElapsed(Math.floor((heartbeatStore.getState().now - startedAt) / 1000));

    return heartbeatStore.subscribe((state) => {
      setElapsed(Math.floor((state.now - startedAt) / 1000));
    });
  }, [startedAt]);

  return elapsed;
}

// ── useElapsedMs ──────────────────────────────────────────────────────────────
// Returns milliseconds elapsed since `startedAt`. Returns 0 when `startedAt` is null.

export function useElapsedMs(startedAt: number | null): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }

    // See useElapsedSeconds above — must read the same time source (heartbeatStore.now(), not
    // Date.now()) for the initial value, or the first render can read as ~0 or ~999ms depending
    // on where in the current second the heartbeat last ticked.
    setElapsed(heartbeatStore.getState().now - startedAt);

    return heartbeatStore.subscribe((state) => {
      setElapsed(state.now - startedAt);
    });
  }, [startedAt]);

  return elapsed;
}

// ── formatElapsed ─────────────────────────────────────────────────────────────

export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
