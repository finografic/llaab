import { describe, expect, it } from 'vitest';

import { collectVaultDirectoryPaths } from './vault-browser.utils';

describe('collectVaultDirectoryPaths', () => {
  it('returns unique parent directories shallowest-first', () => {
    expect(
      collectVaultDirectoryPaths(['nodes/ideas/a.md', 'nodes/resources/b.md', 'README.md', 'sources/x.md']),
    ).toEqual(['nodes', 'sources', 'nodes/ideas', 'nodes/resources']);
  });

  it('ignores root-level files', () => {
    expect(collectVaultDirectoryPaths(['AGENTS.md', 'README.md'])).toEqual([]);
  });
});
