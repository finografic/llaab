import { runAgentLoop } from '@llaab/skills';
import type { CommandContext, CommandHandler } from './handler.js';
import type { AgentRunCommand, OutputEvent } from '@llaab/core';

export const agentCommandHandler: CommandHandler<AgentRunCommand> = {
  kind: 'agent.run',
  async *handle(command: AgentRunCommand, _context: CommandContext): AsyncGenerator<OutputEvent> {
    const executor = command.executor ?? 'llaab';

    yield {
      type: 'meta',
      data: {
        kind: 'agent.run',
        executor,
        nodeId: command.nodeId,
        task: command.task,
        taskId: command.taskId,
        force: command.force,
      },
    };

    if (executor !== 'llaab') {
      throw new Error(`Agent executor "${executor}" is reserved but not implemented yet.`);
    }

    const summary = await runAgentLoop({
      nodeId: command.nodeId,
      force: command.force,
    });

    yield {
      type: 'stdout',
      data: JSON.stringify(summary, null, 2),
    };
  },
};
