import { CommandEnvelopeSchema, getCommandCapabilities } from '@llaab/core';
import { runSkill } from '@llaab/skills';
import type { CommandContext, CommandHandler } from './handler.js';
import type { Command, CommandEnvelope, OutputEnvelope, OutputEvent } from '@llaab/core';

import { agentCommandHandler } from './agent-command.handler.js';
import { chatCommandHandler } from './chat-command.handler.js';
import { cronCommandHandler } from './cron-command.handler.js';
import { fsListCommandHandler, fsReadCommandHandler } from './fs-command.handler.js';
import { llmCommandHandler } from './llm-command.handler.js';
import { shellCommandHandler } from './shell-command.handler.js';

export const defaultCommandHandlers: CommandHandler[] = [
  llmCommandHandler,
  chatCommandHandler,
  agentCommandHandler,
  cronCommandHandler,
  fsReadCommandHandler,
  fsListCommandHandler,
  shellCommandHandler,
] as CommandHandler[];

function outputEnvelope(id: string, event: OutputEvent): OutputEnvelope {
  return {
    id,
    timestamp: new Date().toISOString(),
    event,
  };
}

function commandRunName(envelope: CommandEnvelope): string {
  return `command-${envelope.command.kind.replace('.', '-')}-${envelope.id}`;
}

function summarizeEvents(events: OutputEvent[]): Array<Record<string, unknown>> {
  return events.map((event) => {
    if ('data' in event && typeof event.data === 'string') {
      return {
        type: event.type,
        data: event.data.length > 240 ? `${event.data.slice(0, 237)}...` : event.data,
      };
    }
    return event;
  });
}

async function persistCommandRun(input: {
  envelope: CommandEnvelope;
  events: OutputEvent[];
  exitCode: number;
  error?: Error;
}): Promise<string> {
  const runInput = {
    capabilities: getCommandCapabilities(input.envelope.command),
    commandId: input.envelope.id,
    source: input.envelope.source,
    command: input.envelope.command,
  };

  if (input.error) {
    const { record } = await runSkill(
      commandRunName(input.envelope),
      async () => {
        throw input.error;
      },
      runInput,
    );
    return record.runNodeId;
  }

  const { record } = await runSkill(
    commandRunName(input.envelope),
    async () => ({
      commandId: input.envelope.id,
      capabilities: getCommandCapabilities(input.envelope.command),
      kind: input.envelope.command.kind,
      exitCode: input.exitCode,
      eventCount: input.events.length,
      events: summarizeEvents(input.events),
    }),
    runInput,
  );
  return record.runNodeId;
}

function findHandler(command: Command, handlers: CommandHandler[]): CommandHandler | undefined {
  return handlers.find((handler) => handler.kind === command.kind);
}

export async function* dispatchCommandEnvelope(
  input: unknown,
  handlers: CommandHandler[] = defaultCommandHandlers,
): AsyncGenerator<OutputEnvelope> {
  const parsed = CommandEnvelopeSchema.safeParse(input);
  if (!parsed.success) {
    const id = typeof input === 'object' && input !== null && 'id' in input ? String(input.id) : 'invalid';
    yield outputEnvelope(id, {
      type: 'error',
      code: 'COMMAND_VALIDATION_FAILED',
      message: parsed.error.message,
    });
    yield outputEnvelope(id, { type: 'done', code: 1 });
    return;
  }

  const envelope = parsed.data;
  const events: OutputEvent[] = [];
  const handler = findHandler(envelope.command, handlers);
  const context: CommandContext = { envelope };
  let exitCode = 0;
  let error: Error | undefined;

  if (!handler) {
    error = new Error(`No command handler registered for "${envelope.command.kind}".`);
    exitCode = 1;
    const event: OutputEvent = {
      type: 'error',
      code: 'COMMAND_HANDLER_NOT_FOUND',
      message: error.message,
    };
    events.push(event);
    yield outputEnvelope(envelope.id, event);
  } else {
    try {
      for await (const event of handler.handle(envelope.command, context)) {
        events.push(event);
        yield outputEnvelope(envelope.id, event);
      }
    } catch (caught) {
      error = caught instanceof Error ? caught : new Error(String(caught));
      exitCode = 1;
      const event: OutputEvent = {
        type: 'error',
        code: 'COMMAND_EXECUTION_FAILED',
        message: error.message,
      };
      events.push(event);
      yield outputEnvelope(envelope.id, event);
    }
  }

  const runNodeId = await persistCommandRun({ envelope, events, exitCode, error });
  yield outputEnvelope(envelope.id, {
    type: 'meta',
    data: {
      kind: 'command.run',
      runId: runNodeId,
      href: `/vault/runs/${runNodeId}`,
    },
  });
  yield outputEnvelope(envelope.id, { type: 'done', code: exitCode });
}
