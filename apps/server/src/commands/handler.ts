import type { Command, CommandEnvelope, OutputEvent } from '@llaab/core';

export interface CommandContext {
  envelope: CommandEnvelope;
}

export interface CommandHandler<TCommand extends Command = Command> {
  readonly kind: TCommand['kind'];
  handle(command: TCommand, context: CommandContext): AsyncGenerator<OutputEvent>;
}
