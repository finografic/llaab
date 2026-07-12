import type { Command, OutputEvent } from 'types/terminal-protocol';

import { EXECUTABLE_COMMAND_REFERENCES } from './terminal-panel.constants';

type AiRunTask = Extract<Command, { kind: 'ai.run' }>['task'];

export interface FsListEntry {
  name: string;
  type: 'directory' | 'file';
  path: string;
}

export function websocketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/terminal/ws`;
}

export function splitCommand(input: string): string[] {
  const matches = input.match(/"([^"]*)"|'([^']*)'|\S+/g) ?? [];
  return matches.map((part) => {
    if ((part.startsWith('"') && part.endsWith('"')) || (part.startsWith("'") && part.endsWith("'"))) {
      return part.slice(1, -1);
    }
    return part;
  });
}

export function parseTerminalCommand(input: string, shellSessionId: string): Command {
  const [kind, ...args] = splitCommand(input.trim());

  if (kind === 'ai.run') {
    const [task, ...promptParts] = args;
    if (!task || !isAiRunTask(task)) {
      throw new Error(
        'Usage: ai.run <route|format|extract|consolidate|code|reason|reason-plus|vision|speech> "prompt"',
      );
    }
    const prompt = promptParts.join(' ').trim();
    if (!prompt) throw new Error('Usage: ai.run <task> "prompt"');
    return { kind: 'ai.run', task, prompt };
  }

  if (kind === 'agent.run') {
    const force = args.includes('--force');
    const executorIndex = args.indexOf('--executor');
    const taskIndex = args.indexOf('--task');
    const taskIdIndex = args.indexOf('--task-id');
    const executor = readAgentExecutor(executorIndex === -1 ? undefined : args[executorIndex + 1]);
    const task = taskIndex === -1 ? undefined : args[taskIndex + 1];
    const taskId = taskIdIndex === -1 ? undefined : args[taskIdIndex + 1];
    const nodeId = args.find((arg, index) => {
      if (arg === '--force' || arg === '--executor' || arg === '--task' || arg === '--task-id') return false;
      if (executorIndex !== -1 && index === executorIndex + 1) return false;
      if (taskIndex !== -1 && index === taskIndex + 1) return false;
      if (taskIdIndex !== -1 && index === taskIdIndex + 1) return false;
      return true;
    });
    return { kind: 'agent.run', executor, nodeId, task, taskId, force };
  }

  if (kind === 'cron.run') {
    const [recipeId] = args;
    if (!recipeId) throw new Error('Usage: cron.run <recipe-id>');
    return { kind: 'cron.run', recipeId };
  }

  if (kind === 'fs.read') {
    const [path] = args;
    if (!path) throw new Error('Usage: fs.read <vault-path>');
    return { kind: 'fs.read', path };
  }

  if (kind === 'fs.list') {
    return { kind: 'fs.list', path: args[0] ?? '.' };
  }

  if (kind === 'shell.exec') {
    const confirmed = args.includes('--confirm');
    const enableSession = args.includes('--enable-session');
    const disableSession = args.includes('--disable-session');
    const cwdIndex = args.indexOf('--cwd');
    const cwd = cwdIndex === -1 ? undefined : args[cwdIndex + 1];
    const commandParts: string[] = [];
    for (const [index, arg] of args.entries()) {
      if (arg === '--confirm') continue;
      if (arg === '--enable-session') continue;
      if (arg === '--disable-session') continue;
      if (arg === '--cwd') continue;
      if (cwdIndex !== -1 && index === cwdIndex + 1) continue;
      commandParts.push(arg);
    }
    const [command, ...commandArgs] = commandParts;
    if (!command && !enableSession && !disableSession) {
      throw new Error(
        'Usage: shell.exec --enable-session --confirm | shell.exec --confirm <git|pnpm|node|yt-dlp|opencode> [args...]',
      );
    }
    return {
      kind: 'shell.exec',
      command,
      args: commandArgs,
      cwd,
      confirmed,
      sessionId: shellSessionId,
      enableSession,
      disableSession,
    };
  }

  throw new Error('Unknown command. Try: ai.run extract "summarize this"');
}

function isAiRunTask(value: string): value is AiRunTask {
  return [
    'route',
    'format',
    'extract',
    'consolidate',
    'code',
    'reason',
    'reason-plus',
    'vision',
    'speech',
  ].includes(value);
}

function readAgentExecutor(value: string | undefined): 'llaab' | 'hermes' | undefined {
  if (!value) return undefined;
  if (value === 'llaab' || value === 'hermes') return value;
  throw new Error(
    'Usage: agent.run --executor <llaab|hermes> [--task <name>] [--task-id <id>] [--force] [node-id]',
  );
}

export function readShellSessionEnabled(event: OutputEvent, sessionId: string | null): boolean | null {
  if (event.type !== 'meta') return null;
  if (typeof event.data['shell_session_enabled'] !== 'boolean') return null;
  const metaSessionId = event.data['session_id'];
  if (typeof metaSessionId === 'string' && sessionId && metaSessionId !== sessionId) return null;
  return event.data['shell_session_enabled'];
}

export function eventText(event: OutputEvent): string {
  if (event.type === 'token' || event.type === 'stdout' || event.type === 'stderr') return event.data;
  if (event.type === 'meta') {
    if (event.data['kind'] === 'fs.list') return `listed ${readStringMeta(event.data['path'], '.')}`;
    if (event.data['kind'] === 'fs.read') return `reading ${readStringMeta(event.data['path'], '')}`;
    return JSON.stringify(event.data);
  }
  if (event.type === 'error') return `${event.code ?? 'ERROR'}: ${event.message}`;
  return `done (${event.code})`;
}

export function readStringMeta(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

export function isFsListMeta(event: OutputEvent): event is Extract<OutputEvent, { type: 'meta' }> {
  return event.type === 'meta' && event.data['kind'] === 'fs.list' && Array.isArray(event.data['entries']);
}

export function isCommandRunMeta(event: OutputEvent): event is Extract<OutputEvent, { type: 'meta' }> {
  return (
    event.type === 'meta' && event.data['kind'] === 'command.run' && typeof event.data['href'] === 'string'
  );
}

export function readFsListEntries(event: Extract<OutputEvent, { type: 'meta' }>): FsListEntry[] {
  return (event.data['entries'] as unknown[]).flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate['name'] !== 'string') return [];
    if (typeof candidate['path'] !== 'string') return [];
    if (candidate['type'] !== 'directory' && candidate['type'] !== 'file') return [];
    return [
      {
        name: candidate['name'],
        path: candidate['path'],
        type: candidate['type'],
      },
    ];
  });
}

export function commandForReference(reference: string): string {
  if (reference === 'ai.run') return 'ai.run ';
  if (reference === 'agent.run') return 'agent.run ';
  if (reference === 'cron.run') return 'cron.run ';
  if (reference === 'fs.read') return 'fs.read ';
  if (reference === 'fs.list') return 'fs.list ';
  if (reference === 'shell.exec') return 'shell.exec --confirm ';
  return reference;
}

export function findExecutableReference(text: string, startIndex: number) {
  let nextMatch: { index: number; reference: string } | null = null;
  for (const reference of EXECUTABLE_COMMAND_REFERENCES) {
    const index = text.indexOf(reference, startIndex);
    if (index === -1) continue;
    if (
      !nextMatch ||
      index < nextMatch.index ||
      (index === nextMatch.index && reference.length > nextMatch.reference.length)
    ) {
      nextMatch = { index, reference };
    }
  }
  return nextMatch;
}
