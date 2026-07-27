import type { CommandContext, CommandHandler } from './handler.js';
import type { ChatAskCommand, OutputEvent } from '@llaab/core';

import {
  assembleChatContext,
  buildChatPrompt,
  clearChatSession,
  readChatSession,
  recordChatTurn,
  streamChatAnswer,
} from './knowledge-chat.service.js';

const DEFAULT_CONTEXT_LIMIT = 8;

export const chatCommandHandler: CommandHandler<ChatAskCommand> = {
  kind: 'chat.ask',
  async *handle(command: ChatAskCommand, _context: CommandContext): AsyncGenerator<OutputEvent> {
    if (command.resetSession) {
      clearChatSession(command.sessionId);
    }

    const scope = command.scope ?? 'all';
    const context = await assembleChatContext({
      limit: command.limit ?? DEFAULT_CONTEXT_LIMIT,
      question: command.question,
      scope,
    });

    yield {
      type: 'meta',
      data: {
        kind: 'chat.context',
        scope,
        knowledge_hits: context.knowledge.length,
        vault_hits: context.vault.length,
      },
    };

    const prompt = buildChatPrompt({
      context,
      history: readChatSession(command.sessionId),
      question: command.question,
    });

    let answer = '';
    for await (const chunk of streamChatAnswer({ model: command.model, prompt })) {
      answer += chunk;
      yield { type: 'token', data: chunk };
    }

    recordChatTurn(command.sessionId, { answer, question: command.question });

    yield {
      type: 'meta',
      data: {
        kind: 'chat.sources',
        sources: context.sources,
      },
    };
  },
};
