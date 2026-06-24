import type { CommandContext, CommandHandler } from './handler.js';
import type { CronRunCommand, OutputEvent } from '@llaab/core';

import { runCronRecipe } from '../routes/crons/cron-recipes.js';

export const cronCommandHandler: CommandHandler<CronRunCommand> = {
  kind: 'cron.run',
  async *handle(command: CronRunCommand, _context: CommandContext): AsyncGenerator<OutputEvent> {
    yield {
      type: 'meta',
      data: {
        kind: 'cron.run',
        recipeId: command.recipeId,
      },
    };

    const { historyEntry, result } = await runCronRecipe(command.recipeId);

    yield {
      type: 'meta',
      data: {
        kind: 'cron.run.result',
        historyEntryId: historyEntry.id,
      },
    };
    yield {
      type: 'stdout',
      data: JSON.stringify(result, null, 2),
    };
  },
};
