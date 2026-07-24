import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Characterization tests for the in-memory response cache (Fable migration A0): key derivation
 * and the 24h TTL. The store is a module-level Map, so each test re-imports a fresh module.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
});

function importCache() {
  return import('./cache.js');
}

describe('cache', () => {
  it('returns null for an unknown key', async () => {
    const { cacheGet } = await importCache();

    expect(cacheGet('prompt', 'ollama:model')).toBeNull();
  });

  it('round-trips a value for the same prompt and model', async () => {
    const { cacheGet, cacheSet } = await importCache();

    cacheSet('prompt', 'ollama:model', 'cached-value');

    expect(cacheGet('prompt', 'ollama:model')).toBe('cached-value');
  });

  it('keys on both prompt and model', async () => {
    const { cacheGet, cacheSet } = await importCache();

    cacheSet('prompt', 'ollama:model', 'cached-value');

    expect(cacheGet('prompt', 'ollama:other-model')).toBeNull();
    expect(cacheGet('other prompt', 'ollama:model')).toBeNull();
  });

  it('overwrites an existing entry and refreshes its TTL', async () => {
    vi.useFakeTimers();
    const start = new Date('2026-07-24T00:00:00Z').getTime();
    vi.setSystemTime(start);
    const { cacheGet, cacheSet } = await importCache();

    cacheSet('prompt', 'ollama:model', 'first');
    vi.setSystemTime(start + DAY_MS / 2);
    cacheSet('prompt', 'ollama:model', 'second');

    // 25h after the first write, but only 13h after the second — still fresh.
    vi.setSystemTime(start + DAY_MS + 60 * 60 * 1000);
    expect(cacheGet('prompt', 'ollama:model')).toBe('second');
  });

  it('expires entries strictly after 24 hours and deletes them on read', async () => {
    vi.useFakeTimers();
    const start = new Date('2026-07-24T00:00:00Z').getTime();
    vi.setSystemTime(start);
    const { cacheGet, cacheSet } = await importCache();

    cacheSet('prompt', 'ollama:model', 'cached-value');

    vi.setSystemTime(start + DAY_MS);
    expect(cacheGet('prompt', 'ollama:model')).toBe('cached-value');

    vi.setSystemTime(start + DAY_MS + 1);
    expect(cacheGet('prompt', 'ollama:model')).toBeNull();

    // The expired entry was deleted, so rolling the clock back does not resurrect it.
    vi.setSystemTime(start);
    expect(cacheGet('prompt', 'ollama:model')).toBeNull();
  });

  it('cacheDelete removes exactly the matching key', async () => {
    const { cacheDelete, cacheGet, cacheSet } = await importCache();

    cacheSet('prompt', 'ollama:model', 'cached-value');
    cacheSet('prompt', 'ollama:other-model', 'other-value');

    cacheDelete('prompt', 'ollama:model');

    expect(cacheGet('prompt', 'ollama:model')).toBeNull();
    expect(cacheGet('prompt', 'ollama:other-model')).toBe('other-value');
  });
});
