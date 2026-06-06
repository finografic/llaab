import type { ExecutorProvider } from './executor-provider.js';
import type { Capability } from '@llaab/core';

import { opencodeExecutor } from './executors/opencode.js';

const EXECUTOR_PROVIDERS: ExecutorProvider[] = [opencodeExecutor];

export function findExecutorProvidersByCapability(capability: Capability): ExecutorProvider[] {
  return EXECUTOR_PROVIDERS.filter((provider) => provider.capabilities.includes(capability));
}

export async function getExecutorStatus(): Promise<
  Array<{
    available: boolean;
    capabilities: Capability[];
    displayName: string;
    provider: string;
    requiresConfirmation: boolean;
  }>
> {
  return Promise.all(
    EXECUTOR_PROVIDERS.map(async (provider) => ({
      available: await provider.isAvailable(),
      capabilities: provider.capabilities,
      displayName: provider.displayName,
      provider: provider.id,
      requiresConfirmation: provider.requiresConfirmation,
    })),
  );
}
