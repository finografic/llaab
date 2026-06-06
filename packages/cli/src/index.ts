#!/usr/bin/env node
import { defineCommand, runMain } from 'citty';

import { adaptersCommand } from './commands/adapters.js';
import { agentCommand } from './commands/agent.js';
import { doctorCommand } from './commands/doctor.js';
import { ingestCommand } from './commands/ingest.js';
import { mcpCommand } from './commands/mcp.js';
import { routeCommand } from './commands/route.js';
import { vaultCommand } from './commands/vault.js';

const main = defineCommand({
  meta: {
    name: 'llaab',
    version: '0.0.1',
    description: 'Learning Loop & Agent Automation Base',
  },
  subCommands: {
    adapters: adaptersCommand,
    agent: agentCommand,
    doctor: doctorCommand,
    ingest: ingestCommand,
    mcp: mcpCommand,
    route: routeCommand,
    vault: vaultCommand,
  },
});

runMain(main);
