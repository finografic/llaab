import { Badge } from 'components/ui/badge';
import { Button } from 'components/ui/button';
import { Input } from 'components/ui/input';
import { ScrollArea } from 'components/ui/scroll-area';
import { Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Command, OutputEnvelope, OutputEvent } from '@llaab/core';

type AiRunTask = Extract<Command, { kind: 'ai.run' }>['task'];

interface TerminalLine {
  id: string;
  kind: 'input' | OutputEvent['type'] | 'system';
  text: string;
}

const SERVER_URL =
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.PUBLIC_SERVER_URL ??
  'http://localhost:3000';

function websocketUrl(): string {
  const url = new URL(SERVER_URL);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/terminal';
  return url.toString();
}

function splitCommand(input: string): string[] {
  const matches = input.match(/"([^"]*)"|'([^']*)'|\\S+/g) ?? [];
  return matches.map((part) => {
    if ((part.startsWith('"') && part.endsWith('"')) || (part.startsWith("'") && part.endsWith("'"))) {
      return part.slice(1, -1);
    }
    return part;
  });
}

function parseTerminalCommand(input: string, shellSessionId: string): Command {
  const [kind, ...args] = splitCommand(input.trim());

  if (kind === 'ai.run') {
    const [task, ...promptParts] = args;
    if (!task || !isAiRunTask(task)) {
      throw new Error('Usage: ai.run <route|format|extract|code|reason|reason-plus|vision|speech> "prompt"');
    }
    const prompt = promptParts.join(' ').trim();
    if (!prompt) throw new Error('Usage: ai.run <task> "prompt"');
    return { kind: 'ai.run', task, prompt };
  }

  if (kind === 'agent.run') {
    const force = args.includes('--force');
    const nodeId = args.find((arg) => arg !== '--force');
    return { kind: 'agent.run', nodeId, force };
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
  return ['route', 'format', 'extract', 'code', 'reason', 'reason-plus', 'vision', 'speech'].includes(value);
}

function eventText(event: OutputEvent): string {
  if (event.type === 'token' || event.type === 'stdout' || event.type === 'stderr') return event.data;
  if (event.type === 'meta') return JSON.stringify(event.data);
  if (event.type === 'error') return `${event.code ?? 'ERROR'}: ${event.message}`;
  return `done (${event.code})`;
}

export function TerminalPanel() {
  const [command, setCommand] = useState('ai.run extract "Summarize this short note into three ideas"');
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: 'welcome',
      kind: 'system',
      text: 'Connected commands: ai.run, agent.run, fs.read, fs.list, shell.exec',
    },
    {
      id: 'shell-warning',
      kind: 'system',
      text: 'shell.exec is allowlisted power-user mode. Run shell.exec --enable-session --confirm once, then use --confirm on each command.',
    },
  ]);
  const [connected, setConnected] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const shellSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const socket = new WebSocket(websocketUrl());
    socketRef.current = socket;

    socket.addEventListener('open', () => {
      setConnected(true);
      setLines((current) => [...current, { id: crypto.randomUUID(), kind: 'system', text: 'socket open' }]);
    });

    socket.addEventListener('close', () => {
      setConnected(false);
      setLines((current) => [...current, { id: crypto.randomUUID(), kind: 'system', text: 'socket closed' }]);
    });

    socket.addEventListener('message', (event) => {
      const envelope = JSON.parse(String(event.data)) as OutputEnvelope;
      setLines((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          kind: envelope.event.type,
          text: eventText(envelope.event),
        },
      ]);
    });

    return () => socket.close();
  }, []);

  function submitCommand() {
    const trimmed = command.trim();
    if (!trimmed) return;

    try {
      shellSessionIdRef.current ??= crypto.randomUUID();
      const parsed = parseTerminalCommand(trimmed, shellSessionIdRef.current);
      socketRef.current?.send(
        JSON.stringify({
          id: crypto.randomUUID(),
          source: 'terminal',
          timestamp: new Date().toISOString(),
          command: parsed,
        }),
      );
      setLines((current) => [...current, { id: crypto.randomUUID(), kind: 'input', text: trimmed }]);
      setHistory((current) => [trimmed, ...current.filter((item) => item !== trimmed)].slice(0, 20));
      setHistoryIndex(null);
    } catch (error) {
      setLines((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          kind: 'error',
          text: error instanceof Error ? error.message : String(error),
        },
      ]);
    }
  }

  function recallHistory(direction: 'older' | 'newer') {
    if (history.length === 0) return;
    const nextIndex =
      direction === 'older'
        ? Math.min((historyIndex ?? -1) + 1, history.length - 1)
        : Math.max((historyIndex ?? 1) - 1, 0);
    setHistoryIndex(nextIndex);
    setCommand(history[nextIndex] ?? '');
  }

  return (
    <section className="flex min-h-[70vh] flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Terminal</h1>
          <p className="text-sm text-muted-foreground">Typed command bus for orchestration adapters.</p>
        </div>
        <Badge variant={connected ? 'default' : 'secondary'}>{connected ? 'connected' : 'offline'}</Badge>
      </div>

      <ScrollArea className="min-h-[52vh] rounded-md border bg-card p-3">
        <div className="space-y-1 font-mono text-sm">
          {lines.map((line) => (
            <div key={line.id} className="grid grid-cols-[5rem_1fr] gap-3 whitespace-pre-wrap">
              <span className="text-muted-foreground">{line.kind}</span>
              <span>{line.text}</span>
            </div>
          ))}
        </div>
      </ScrollArea>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submitCommand();
        }}
      >
        <Input
          aria-label="Terminal command"
          className="font-mono"
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              recallHistory('older');
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              recallHistory('newer');
            }
          }}
        />
        <Button type="submit" disabled={!connected}>
          <Send />
          Run
        </Button>
      </form>
    </section>
  );
}
