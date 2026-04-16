#!/usr/bin/env node
import { defineCommand, runMain } from 'citty';

import { agentCommand } from './commands/agent.js';
import { ingestCommand } from './commands/ingest.js';
import { mcpCommand } from './commands/mcp.js';
import { vaultCommand } from './commands/vault.js';

const main = defineCommand({
  meta: {
    name: 'llaab',
    version: '0.0.1',
    description: 'Learning Loop & Agent Automation Base',
  },
  subCommands: {
    agent: agentCommand,
    ingest: ingestCommand,
    mcp: mcpCommand,
    vault: vaultCommand,
  },
});

runMain(main);
