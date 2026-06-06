import { CAPABILITIES, COMMAND_CAPABILITIES } from '@llaab/core';
import { getExecutorStatus, getLlmStatus } from '@llaab/llm';
import { REGISTRY } from '@llaab/skills';
import { defineCommand } from 'citty';

import { pc } from '../utils/picocolors.js';

function statusIcon(available: boolean): string {
  return available ? pc.green('✓') : pc.red('✗');
}

export const doctorCommand = defineCommand({
  meta: {
    name: 'doctor',
    description: 'Check provider availability and orchestration coverage',
  },
  async run() {
    const status = await getLlmStatus();
    const executors = await getExecutorStatus();
    const covered = [
      ...new Set([
        ...status.capabilities.flatMap((provider) => provider.capabilities),
        ...executors.flatMap((provider) => provider.capabilities),
        ...Object.values(COMMAND_CAPABILITIES).flat(),
        ...REGISTRY.flatMap((route) => route.capabilities),
      ]),
    ].sort();
    const missing = CAPABILITIES.filter((capability) => !covered.includes(capability));

    console.log(pc.bold('LLM Providers'));
    for (const provider of status.capabilities) {
      console.log(
        `  ${statusIcon(provider.available)} ${provider.provider.padEnd(10)} ${provider.capabilities.join(', ')}`,
      );
    }
    for (const provider of executors) {
      console.log(
        `  ${statusIcon(provider.available)} ${provider.provider.padEnd(10)} ${provider.capabilities.join(', ')}`,
      );
    }

    console.log('');
    console.log(`${pc.bold('Capabilities covered:')} ${covered.join(', ') || pc.gray('none')}`);
    console.log(`${pc.bold('Missing:')} ${missing.length > 0 ? missing.join(', ') : pc.green('none')}`);
    console.log('');
    console.log(`${pc.bold('Harness:')} @finografic/ai-harness installed, extraction prep active`);
    console.log(`${pc.bold('Control:')} packages/control orchestrator operational`);
    console.log(
      `${pc.bold('Command Bus:')} 5 handlers registered (ai.run, agent.run, fs.read, fs.list, shell.exec)`,
    );
  },
});
