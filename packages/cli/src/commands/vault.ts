import { listNodes } from '@llaab/core';
import { defineCommand } from 'citty';
import type { NodeType } from '@llaab/schemas';

import { pc } from '../utils/picocolors.js';

const NODE_TYPES: NodeType[] = [
  'idea',
  'skill',
  'prompt',
  'instruction',
  'transcript',
  'resource',
  'source',
  'decision',
  'run',
];

const STATUS_COLOR: Record<string, (s: string) => string> = {
  seed: pc.gray,
  growing: pc.yellow,
  mature: pc.green,
  archived: pc.gray,
};

export const vaultCommand = defineCommand({
  meta: {
    name: 'vault',
    description: 'Browse vault nodes',
  },
  subCommands: {
    list: defineCommand({
      meta: {
        name: 'list',
        description: 'List vault nodes',
      },
      args: {
        type: {
          type: 'string',
          description: `Node type filter (${NODE_TYPES.join(', ')})`,
        },
        status: {
          type: 'string',
          description: 'Status filter (seed, growing, mature, archived)',
        },
        limit: {
          type: 'string',
          description: 'Max results',
        },
      },
      async run({ args }) {
        const { type, status, limit } = args;

        if (type && !NODE_TYPES.includes(type as NodeType)) {
          console.error(pc.red(`Unknown type "${type}". Valid types: ${NODE_TYPES.join(', ')}`));
          process.exit(1);
        }

        const nodes = await listNodes({
          type: type as NodeType | undefined,
          status: status as 'seed' | 'growing' | 'mature' | 'archived' | undefined,
          limit: limit ? parseInt(limit, 10) : undefined,
        });

        if (nodes.length === 0) {
          console.log(pc.gray('No nodes found.'));
          return;
        }

        const typeWidth = Math.max(...nodes.map((n) => n.type.length));
        const idWidth = Math.max(...nodes.map((n) => n.id.length));

        for (const node of nodes) {
          const colorStatus = (STATUS_COLOR[node.status] ?? pc.gray)(node.status);
          const tags = node.tags.length ? pc.gray(` [${node.tags.join(', ')}]`) : '';
          console.log(
            `${pc.cyan(node.type.padEnd(typeWidth))}  ${node.id.padEnd(idWidth)}  ${colorStatus}${tags}`,
          );
        }

        console.log(pc.gray(`\n${nodes.length} node${nodes.length === 1 ? '' : 's'}`));
      },
    }),
  },
});
