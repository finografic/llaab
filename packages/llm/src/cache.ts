import { createHash } from 'node:crypto';

const TTL_MS = 24 * 60 * 60 * 1000; // 24 h

interface CacheEntry {
  value: string;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

function cacheKey(prompt: string, model: string): string {
  return createHash('sha256').update(`${model}:${prompt}`).digest('hex');
}

export function cacheGet(prompt: string, model: string): string | null {
  const k = cacheKey(prompt, model);
  const entry = store.get(k);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(k);
    return null;
  }
  return entry.value;
}

export function cacheSet(prompt: string, model: string, value: string): void {
  store.set(cacheKey(prompt, model), { value, expiresAt: Date.now() + TTL_MS });
}
