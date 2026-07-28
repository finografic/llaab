import { describe, expect, it } from 'vitest';

import {
  DOMAIN_TAG_COLORS,
  domainTagStyle,
  isDomainTag,
  resolveDomainTagColor,
} from './domain-tag-color.utils';

describe('domain-tag-color.utils', () => {
  it('detects domain tags', () => {
    expect(isDomainTag('d:llm')).toBe(true);
    expect(isDomainTag('hermes')).toBe(false);
  });

  it('returns canonical colors for known domains', () => {
    expect(resolveDomainTagColor('d:ingest')).toBe(DOMAIN_TAG_COLORS['d:ingest']);
    expect(resolveDomainTagColor('d:meta')).toBe(DOMAIN_TAG_COLORS['d:meta']);
  });

  it('returns null for non-domain tags', () => {
    expect(resolveDomainTagColor('inbox')).toBeNull();
    expect(domainTagStyle('inbox')).toBeUndefined();
  });

  it('hashes unknown domain tags to a stable oklch color', () => {
    const first = resolveDomainTagColor('d:future-domain');
    const second = resolveDomainTagColor('d:future-domain');
    expect(first).toMatch(/^oklch\(0\.72 0\.14 \d+\)$/);
    expect(first).toBe(second);
    expect(first).not.toBe(resolveDomainTagColor('d:other-future'));
  });

  it('exposes --tag-color for CSS consumers', () => {
    expect(domainTagStyle('d:llm')).toEqual({ '--tag-color': DOMAIN_TAG_COLORS['d:llm'] });
  });
});
