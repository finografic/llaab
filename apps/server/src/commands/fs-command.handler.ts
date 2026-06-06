import { readdir, readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { VAULT_ROOT } from '@llaab/core';
import type { CommandContext, CommandHandler } from './handler.js';
import type { FsListCommand, FsReadCommand, OutputEvent } from '@llaab/core';

type FsCommand = FsReadCommand | FsListCommand;

function resolveVaultPath(inputPath: string): string {
  const resolvedPath = resolve(VAULT_ROOT, inputPath);
  if (resolvedPath !== VAULT_ROOT && !resolvedPath.startsWith(VAULT_ROOT + sep)) {
    throw new Error('Path is outside the vault root.');
  }
  return resolvedPath;
}

export const fsReadCommandHandler: CommandHandler<FsReadCommand> = {
  kind: 'fs.read',
  async *handle(command: FsReadCommand, _context: CommandContext): AsyncGenerator<OutputEvent> {
    const resolvedPath = resolveVaultPath(command.path);
    yield {
      type: 'stdout',
      data: await readFile(resolvedPath, 'utf-8'),
    };
  },
};

export const fsListCommandHandler: CommandHandler<FsListCommand> = {
  kind: 'fs.list',
  async *handle(command: FsListCommand, _context: CommandContext): AsyncGenerator<OutputEvent> {
    const resolvedPath = resolveVaultPath(command.path);
    const entries = await readdir(resolvedPath, { withFileTypes: true });
    yield {
      type: 'stdout',
      data: JSON.stringify(
        entries.map((entry) => ({
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
        })),
        null,
        2,
      ),
    };
  },
};

export type { FsCommand };
