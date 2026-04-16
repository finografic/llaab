import { getAgentStatus, runAgentLoop } from '@llaab/skills';
import { defineCommand } from 'citty';

import { pc } from '../utils/picocolors.js';

export const agentCommand = defineCommand({
  meta: {
    name: 'agent',
    description: 'Agent loop commands',
  },
  subCommands: {
    run: defineCommand({
      meta: {
        name: 'run',
        description: 'Process unprocessed vault nodes through the skill registry (one-shot)',
      },
      args: {
        node: {
          type: 'string',
          description: 'Scope to a single node ID',
          alias: 'n',
        },
        force: {
          type: 'boolean',
          description: 'Re-run even if already processed (clears dedup index)',
          default: false,
        },
      },
      async run({ args }) {
        console.log(pc.cyan('Running agent loop…'));
        if (args.node) console.log(pc.gray(`  node: ${args.node}`));
        if (args.force) console.log(pc.yellow('  force — dedup index cleared'));

        const summary = await runAgentLoop({ nodeId: args.node, force: args.force });

        const statusWidth = 9;
        console.log('');
        console.log(`  ${'scanned'.padEnd(statusWidth)} ${summary.scanned}`);
        console.log(`  ${pc.green('processed'.padEnd(statusWidth))} ${summary.processed}`);
        console.log(`  ${pc.gray('skipped'.padEnd(statusWidth))} ${summary.skipped}`);
        if (summary.failed > 0) {
          console.log(`  ${pc.red('failed'.padEnd(statusWidth))} ${summary.failed}`);
        }

        for (const run of summary.runs.filter((r) => r.status === 'failed')) {
          console.log('');
          console.log(`  ${pc.red('✗')} ${run.nodeId}  ${pc.gray(run.skill)}`);
          if (run.error) console.log(`    ${pc.red(run.error)}`);
        }
      },
    }),

    status: defineCommand({
      meta: {
        name: 'status',
        description: 'Show agent loop status and last-run metadata',
      },
      async run() {
        const status = await getAgentStatus();
        console.log(`  ${'last run'.padEnd(12)} ${status.lastRunAt ?? pc.gray('never')}`);
        console.log(`  ${'processed'.padEnd(12)} ${status.totalProcessed}`);
        console.log(`  ${'skipped'.padEnd(12)} ${status.totalSkipped}`);
        console.log(`  ${'failed'.padEnd(12)} ${status.totalFailed}`);
        console.log(`  ${'index'.padEnd(12)} ${pc.gray(status.indexPath)}`);
      },
    }),
  },
});
