import { describe, expect, it } from 'vitest';
import type { Command } from './command-protocol.js';

import { getCommandCapabilities } from './capability.js';

describe('getCommandCapabilities', () => {
  it('maps command kinds to deterministic capabilities', () => {
    const command: Command = {
      kind: 'ai.run',
      task: 'extract',
      prompt: 'Extract ideas from this transcript',
    };

    expect(getCommandCapabilities(command)).toEqual(['chat', 'extract', 'reason', 'command_run']);
  });

  it('maps shell execution to explicit shell capability', () => {
    const command: Command = {
      kind: 'shell.exec',
      command: 'node',
      args: ['--version'],
      confirmed: true,
    };

    expect(getCommandCapabilities(command)).toEqual(['shell_exec', 'command_run']);
  });
});
