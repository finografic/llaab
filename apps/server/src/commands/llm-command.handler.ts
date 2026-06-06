import { streamLlm } from '@llaab/llm';
import type { CommandContext, CommandHandler } from './handler.js';
import type { AiRunCommand, OutputEvent } from '@llaab/core';

export const llmCommandHandler: CommandHandler<AiRunCommand> = {
  kind: 'ai.run',
  async *handle(command: AiRunCommand, _context: CommandContext): AsyncGenerator<OutputEvent> {
    yield {
      type: 'meta',
      data: {
        task: command.task,
        model: command.model,
      },
    };

    for await (const chunk of streamLlm(command.task, command.prompt, {
      model: command.model,
      system: command.system,
      maxTokens: command.maxTokens,
    })) {
      yield { type: 'token', data: chunk };
    }
  },
};
