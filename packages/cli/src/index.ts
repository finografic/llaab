#!/usr/bin/env node
import { defineCommand, runMain } from 'citty';

import { ingestCommand } from './commands/ingest.js';
import { vaultCommand } from './commands/vault.js';

const main = defineCommand({
  meta: {
    name: 'llaab',
    version: '0.0.1',
    description: 'Learning Loop & Agent Automation Base',
  },
  subCommands: {
    ingest: ingestCommand,
    vault: vaultCommand,
  },
});

runMain(main);
