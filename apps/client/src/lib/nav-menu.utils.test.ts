import { describe, expect, it } from 'vitest';

import { NAV_MENU_SECTIONS } from './nav-menu.config';
import { getActiveNavItemHref, getActiveNavSectionId, isNavItemActive } from './nav-menu.utils';

describe('getActiveNavSectionId', () => {
  it('resolves registry and knowledge', () => {
    expect(getActiveNavSectionId('/registry/packages')).toBe('registry');
    expect(getActiveNavSectionId('/registry/repos/foo/bar')).toBe('registry');
    expect(getActiveNavSectionId('/knowledge/wikis')).toBe('knowledge');
  });

  it('keeps execute ahead of vault for runs, and covers hermes/crons/terminal', () => {
    expect(getActiveNavSectionId('/vault/runs')).toBe('execute');
    expect(getActiveNavSectionId('/hermes')).toBe('execute');
    expect(getActiveNavSectionId('/crons')).toBe('execute');
    expect(getActiveNavSectionId('/terminal')).toBe('execute');
  });

  it('resolves vault for other vault paths and null for home', () => {
    expect(getActiveNavSectionId('/vault/transcripts')).toBe('vault');
    expect(getActiveNavSectionId('/')).toBeNull();
  });
});

describe('isNavItemActive', () => {
  it('matches exact and nested paths', () => {
    expect(isNavItemActive('/vault', '/vault')).toBe(true);
    expect(isNavItemActive('/vault/nodes', '/vault')).toBe(true);
    expect(isNavItemActive('/vault/nodes', '/vault/nodes')).toBe(true);
    expect(isNavItemActive('/vault', '/vault/nodes')).toBe(false);
  });
});

describe('getActiveNavItemHref', () => {
  const vaultHrefs = [
    '/vault',
    '/vault/nodes',
    '/vault/transcripts',
    '/vault/sources',
    '/vault/inbox',
    '/vault/wiki-candidates',
    '/vault/search',
  ];

  it('prefers the longest matching href among siblings', () => {
    expect(getActiveNavItemHref('/vault/transcripts/abc', vaultHrefs)).toBe('/vault/transcripts');
    expect(getActiveNavItemHref('/vault', vaultHrefs)).toBe('/vault');
    expect(getActiveNavItemHref('/vault/nodes', vaultHrefs)).toBe('/vault/nodes');
  });

  it('returns null when nothing matches', () => {
    expect(getActiveNavItemHref('/llm', vaultHrefs)).toBeNull();
  });
});

describe('NAV_MENU_SECTIONS', () => {
  it('does not register duplicate live hrefs inside a section', () => {
    for (const section of NAV_MENU_SECTIONS) {
      const liveHrefs = section.items.filter((item) => item.live).map((item) => item.href);
      expect(new Set(liveHrefs).size).toBe(liveHrefs.length);
    }
  });
});
