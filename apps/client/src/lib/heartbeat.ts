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

    setElapsed(Math.floor((Date.now() - startedAt) / 1000));

    return heartbeatStore.subscribe((state) => {
      setElapsed(Math.floor((state.now - startedAt) / 1000));
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
