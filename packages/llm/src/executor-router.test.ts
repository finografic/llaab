import { describe, expect, it } from 'vitest';

import { findExecutorProvidersByCapability } from './executor-router.js';

describe('findExecutorProvidersByCapability', () => {
  it('registers OpenCode for coding executor capabilities', () => {
    expect(findExecutorProvidersByCapability('code_edit').map((provider) => provider.id)).toEqual([
      'opencode',
    ]);
    expect(findExecutorProvidersByCapability('shell_exec').map((provider) => provider.id)).toEqual([
      'opencode',
    ]);
  });
});
