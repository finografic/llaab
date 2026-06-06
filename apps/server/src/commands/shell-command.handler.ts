import { spawn } from 'node:child_process';
import type { CommandContext, CommandHandler } from './handler.js';
import type { OutputEvent, ShellExecCommand } from '@llaab/core';

const ALLOWED_SHELL_COMMANDS = new Set(['git', 'pnpm', 'node', 'yt-dlp', 'opencode']);

function runAllowedCommand(command: ShellExecCommand): Promise<{
  durationMs: number;
  exitCode: number;
  stderr: string;
  stdout: string;
}> {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const child = spawn(command.command, command.args, {
      cwd: command.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({
        durationMs: Math.round(performance.now() - start),
        exitCode: code ?? 1,
        stderr,
        stdout,
      });
    });
  });
}

export const shellCommandHandler: CommandHandler<ShellExecCommand> = {
  kind: 'shell.exec',
  async *handle(command: ShellExecCommand, _context: CommandContext): AsyncGenerator<OutputEvent> {
    if (!command.confirmed) {
      throw new Error('shell.exec requires explicit per-command confirmation.');
    }

    if (!ALLOWED_SHELL_COMMANDS.has(command.command)) {
      throw new Error(`Command "${command.command}" is not allowlisted for shell.exec.`);
    }

    const result = await runAllowedCommand(command);
    if (result.stdout) yield { type: 'stdout', data: result.stdout };
    if (result.stderr) yield { type: 'stderr', data: result.stderr };
    yield {
      type: 'meta',
      data: {
        command: command.command,
        cwd: command.cwd,
        duration_ms: result.durationMs,
        exit_code: result.exitCode,
        stderr_summary: result.stderr.slice(0, 240),
        stdout_summary: result.stdout.slice(0, 240),
      },
    };
  },
};

export { ALLOWED_SHELL_COMMANDS };
