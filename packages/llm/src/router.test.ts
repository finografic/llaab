import { describe, expect, it } from 'vitest';

import { findProvidersByCapability } from './router.js';

describe('findProvidersByCapability', () => {
  it('returns local and remote providers for extraction', () => {
    expect(findProvidersByCapability('extract').map((provider) => provider.id)).toEqual([
      'ollama',
      'anthropic',
      'lmstudio',
      'opencode',
    ]);
  });

  it('keeps reason routed to the remote provider only', () => {
    expect(findProvidersByCapability('reason').map((provider) => provider.id)).toEqual([
      'anthropic',
      'opencode',
    ]);
  });
});
