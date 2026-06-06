import { CAPABILITIES, CapabilitySchema } from '@llaab/core';
import { findProvidersByCapability, getLlmStatus } from '@llaab/llm';
import { defineCommand } from 'citty';

import { pc } from '../utils/picocolors.js';

export const adaptersCommand = defineCommand({
  meta: {
    name: 'adapters',
    description: 'List registered execution adapters',
  },
  subCommands: {
    list: defineCommand({
      meta: {
        name: 'list',
        description: 'List LLM providers and declared capabilities',
      },
      args: {
        capability: {
          type: 'string',
          description: `Filter by capability (${CAPABILITIES.join(', ')})`,
        },
      },
      async run({ args }) {
        const parsedCapability = args.capability ? CapabilitySchema.safeParse(args.capability) : undefined;
        if (parsedCapability && !parsedCapability.success) {
          console.error(pc.red(`Unknown capability "${args.capability}".`));
          process.exit(1);
        }

        const status = await getLlmStatus();
        const providerIds = parsedCapability?.success
          ? new Set(findProvidersByCapability(parsedCapability.data).map((provider) => provider.id))
          : undefined;
        const providers = providerIds
          ? status.capabilities.filter((provider) => providerIds.has(provider.provider))
          : status.capabilities;

        for (const provider of providers) {
          const availability = provider.available ? pc.green('available') : pc.gray('unavailable');
          console.log(`${pc.cyan(provider.provider.padEnd(10))} ${availability}`);
          console.log(`  ${provider.capabilities.join(', ')}`);
        }
      },
    }),
  },
});
