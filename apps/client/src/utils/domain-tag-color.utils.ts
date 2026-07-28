import type { CSSProperties } from 'react';

/**
 * Canonical domain (`d:*`) tag colors — matches `app.css` `[data-tag="d:…"]` tokens.
 * Known domains keep stable brand colors; any other `d:*` tag gets a deterministic
 * hash color so future domains color-code with zero CSS/JS updates.
 */
export const DOMAIN_TAG_COLORS = {
  'd:llm': '#3b82f6',
  'd:automation': '#8b5cf6',
  'd:ingest': '#f59e0b',
  'd:schema': '#14b8a6',
  'd:infra': '#6b7280',
  'd:integration': '#f97316',
  'd:ui': '#ec4899',
  'd:meta': '#22c55e',
} as const satisfies Record<string, string>;

export type KnownDomainTag = keyof typeof DOMAIN_TAG_COLORS;

export function isDomainTag(tag: string): boolean {
  return tag.startsWith('d:');
}

/** Stable color for any domain tag; `null` for non-domain tags. */
export function resolveDomainTagColor(tag: string): string | null {
  if (!isDomainTag(tag)) return null;
  const known = DOMAIN_TAG_COLORS[tag as KnownDomainTag];
  if (known) return known;
  return hashDomainTagColor(tag.slice(2));
}

/** Inline style that drives `.tag` / `[data-tag]` consumers via `--tag-color`. */
export function domainTagStyle(tag: string): CSSProperties | undefined {
  const color = resolveDomainTagColor(tag);
  if (!color) return undefined;
  return { '--tag-color': color } as CSSProperties;
}

function hashDomainTagColor(slug: string): string {
  let hash = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    hash ^= slug.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hue = (hash >>> 0) % 360;
  return `oklch(0.72 0.14 ${hue})`;
}
