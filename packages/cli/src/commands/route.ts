import { CAPABILITIES, CapabilitySchema } from '@llaab/core';
import { findExecutorProvidersByCapability, findProvidersByCapability, resolveLlmRoute } from '@llaab/llm';
import { defineCommand } from 'citty';
import type { TaskType } from '@llaab/llm';

import { pc } from '../utils/picocolors.js';

const TASKS: TaskType[] = ['format', 'extract', 'code', 'reason'];

export const routeCommand = defineCommand({
  meta: {
    name: 'route',
    description: 'Show provider routing for a capability or LLM task',
  },
  args: {
    target: {
      type: 'positional',
      description: `Capability or task (${CAPABILITIES.join(', ')} / ${TASKS.join(', ')})`,
      required: true,
    },
    explain: {
      type: 'boolean',
      description: 'Explain task routing through the current LLM route map',
      default: false,
    },
  },
  run({ args }) {
    const target = String(args.target);

    if (args.explain) {
      if (!TASKS.includes(target as TaskType)) {
        console.error(pc.red(`Unknown task "${target}". Valid tasks: ${TASKS.join(', ')}`));
        process.exit(1);
      }

      const route = resolveLlmRoute(target as TaskType);
      console.log(`${pc.bold(target)} -> ${route.provider} / ${route.model}`);
      console.log(`  tier: ${route.tier}`);
      return;
    }

    const parsedCapability = CapabilitySchema.safeParse(target);
    if (!parsedCapability.success) {
      console.error(pc.red(`Unknown capability "${target}". Valid capabilities: ${CAPABILITIES.join(', ')}`));
      process.exit(1);
    }

    const providers = [
      ...findProvidersByCapability(parsedCapability.data),
      ...findExecutorProvidersByCapability(parsedCapability.data),
    ];
    if (providers.length === 0) {
      console.log(pc.gray(`No providers declare "${parsedCapability.data}".`));
      return;
    }

    console.log(`${pc.bold(parsedCapability.data)} capability`);
    for (const provider of providers) {
      console.log(`  ${pc.cyan(provider.id)}  ${provider.displayName}`);
    }
  },
});
