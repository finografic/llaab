import { cn } from '@llaab/ui/lib/utils';
import { Badge } from 'components/ui/badge';
import { Button } from 'components/ui/button';
import { Col, Row } from 'components/ui/grid';
import { Input } from 'components/ui/input';
import { ScrollArea } from 'components/ui/scroll-area';
import {
  BotIcon,
  FileTextIcon,
  FolderIcon,
  ListTreeIcon,
  SendIcon,
  SparklesIcon,
  TerminalIcon,
  TimerIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import type { Command, OutputEnvelope, OutputEvent } from 'types/terminal-protocol';

import styles from './TerminalPanel.module.css';

type AiRunTask = Extract<Command, { kind: 'ai.run' }>['task'];
type OutputMode = 'structured' | 'raw' | 'json';

interface TerminalLine {
  id: string;
  cmdId?: string;
  kind: 'input' | OutputEvent['type'] | 'system';
  text: string;
  event?: OutputEvent;
}

interface FsListEntry {
  name: string;
  type: 'directory' | 'file';
  path: string;
}

interface TerminalAction {
  label: string;
  command: string;
}

interface TerminalActionGroup {
  label: string;
  icon: typeof TerminalIcon;
  actions: TerminalAction[];
}

const HISTORY_STORAGE_KEY = 'llaab-terminal-history';
const COMMAND_PLACEHOLDER = 'Type a command, or choose an action';
const COMMAND_SUGGESTIONS = [
  'ai.run extract "Extract three reusable ideas from this note."',
  'ai.run reason "Think through this decision."',
  'agent.run --executor llaab --force',
  'agent.run --executor hermes --task inbox-triage',
  'cron.run check-transcripts-consolidation',
  'fs.list .',
  'fs.list transcripts',
  'fs.list nodes/ideas',
  'fs.list nodes/canonical-ideas',
  'fs.list runs',
  'fs.read transcripts/',
  'shell.exec --enable-session --confirm',
  'shell.exec --confirm node --version',
  'shell.exec --disable-session',
];

const EXECUTABLE_COMMAND_REFERENCES = [
  'shell.exec --enable-session --confirm',
  'shell.exec --disable-session',
  'shell.exec --confirm',
  'agent.run',
  'cron.run',
  'ai.run',
  'fs.read',
  'fs.list',
  'shell.exec',
];

const COMMAND_ACTION_GROUPS: TerminalActionGroup[] = [
  {
    label: 'Vault',
    icon: ListTreeIcon,
    actions: [
      { label: 'List vault root', command: 'fs.list .' },
      { label: 'List transcripts', command: 'fs.list transcripts' },
      { label: 'List idea nodes', command: 'fs.list nodes/ideas' },
      { label: 'List canonical ideas', command: 'fs.list nodes/canonical-ideas' },
      { label: 'List runs', command: 'fs.list runs' },
    ],
  },
  {
    label: 'AI',
    icon: SparklesIcon,
    actions: [
      { label: 'Extract ideas', command: 'ai.run extract "Extract three reusable ideas from this note."' },
      { label: 'Reason through decision', command: 'ai.run reason "Think through this decision."' },
    ],
  },
  {
    label: 'Agents',
    icon: BotIcon,
    actions: [
      { label: 'Run LLAAB agent', command: 'agent.run --executor llaab --force' },
      { label: 'Prepare Hermes task', command: 'agent.run --executor hermes --task inbox-triage' },
    ],
  },
  {
    label: 'Crons',
    icon: TimerIcon,
    actions: [
      { label: 'Check transcript consolidation', command: 'cron.run check-transcripts-consolidation' },
      {
        label: 'Check recent transcript consolidation (7d)',
        command: 'cron.run check-recent-transcripts-consolidation',
      },
    ],
  },
  {
    label: 'Shell',
    icon: TerminalIcon,
    actions: [
      { label: 'Enable shell session', command: 'shell.exec --enable-session --confirm' },
      { label: 'Node version', command: 'shell.exec --confirm node --version' },
      { label: 'Disable shell session', command: 'shell.exec --disable-session' },
    ],
  },
];

const COMMAND_ACTIONS = COMMAND_ACTION_GROUPS.flatMap((group) => group.actions);

function websocketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/terminal`;
}

function splitCommand(input: string): string[] {
  const matches = input.match(/"([^"]*)"|'([^']*)'|\S+/g) ?? [];
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

function eventText(event: OutputEvent): string {
  if (event.type === 'token' || event.type === 'stdout' || event.type === 'stderr') return event.data;
  if (event.type === 'meta') {
    if (event.data['kind'] === 'fs.list') return `listed ${readStringMeta(event.data['path'], '.')}`;
    if (event.data['kind'] === 'fs.read') return `reading ${readStringMeta(event.data['path'], '')}`;
    return JSON.stringify(event.data);
  }
  if (event.type === 'error') return `${event.code ?? 'ERROR'}: ${event.message}`;
  return `done (${event.code})`;
}

function readStringMeta(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function isFsListMeta(event: OutputEvent): event is Extract<OutputEvent, { type: 'meta' }> {
  return event.type === 'meta' && event.data['kind'] === 'fs.list' && Array.isArray(event.data['entries']);
}

function isCommandRunMeta(event: OutputEvent): event is Extract<OutputEvent, { type: 'meta' }> {
  return (
    event.type === 'meta' && event.data['kind'] === 'command.run' && typeof event.data['href'] === 'string'
  );
}

function readFsListEntries(event: Extract<OutputEvent, { type: 'meta' }>): FsListEntry[] {
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

function commandForReference(reference: string): string {
  if (reference === 'ai.run') return 'ai.run ';
  if (reference === 'agent.run') return 'agent.run ';
  if (reference === 'cron.run') return 'cron.run ';
  if (reference === 'fs.read') return 'fs.read ';
  if (reference === 'fs.list') return 'fs.list ';
  if (reference === 'shell.exec') return 'shell.exec --confirm ';
  return reference;
}

function findExecutableReference(text: string, startIndex: number) {
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

export function TerminalPanel() {
  const [command, setCommand] = useState('');
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
  const [outputMode, setOutputMode] = useState<OutputMode>('structured');
  const [history, setHistory] = useState<string[]>(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(HISTORY_STORAGE_KEY) ?? '[]') as unknown;
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      return [];
    }
  });
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const shellSessionIdRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const recentHistory = useMemo(() => history.slice(0, 5), [history]);
  const suggestions = useMemo(
    () => [
      ...new Set([...COMMAND_SUGGESTIONS, ...COMMAND_ACTIONS.map((action) => action.command), ...history]),
    ],
    [history],
  );

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
          cmdId: envelope.id,
          kind: envelope.event.type,
          text: eventText(envelope.event),
          event: envelope.event,
        },
      ]);
    });

    return () => socket.close();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [lines]);

  function submitCommand(nextCommand = command) {
    const trimmed = nextCommand.trim();
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
      setCommand('');
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
        : Math.max((historyIndex ?? 1) - 1, -1);
    setHistoryIndex(nextIndex);
    setCommand(nextIndex === -1 ? '' : (history[nextIndex] ?? ''));
  }

  function insertCommand(nextCommand: string) {
    setCommand(nextCommand);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }

  function runCommand(nextCommand: string) {
    setCommand(nextCommand);
    submitCommand(nextCommand);
  }

  function renderTextWithExecutableReferences(text: string) {
    const parts = [];
    let cursor = 0;
    let match = findExecutableReference(text, cursor);

    while (match) {
      if (match.index > cursor) {
        parts.push(text.slice(cursor, match.index));
      }
      const { reference } = match;
      parts.push(
        <button
          key={`${match.index}-${reference}`}
          type="button"
          className="inline rounded-sm text-primary hover:text-primary/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onClick={() => insertCommand(commandForReference(reference))}
        >
          {reference}
        </button>,
      );
      cursor = match.index + reference.length;
      match = findExecutableReference(text, cursor);
    }

    if (cursor < text.length) {
      parts.push(text.slice(cursor));
    }

    return <>{parts}</>;
  }

  function renderLine(line: TerminalLine) {
    if (outputMode === 'json') {
      return <span>{JSON.stringify(line.event ?? { type: line.kind, text: line.text }, null, 2)}</span>;
    }

    if (outputMode === 'raw') {
      return <span>{line.text}</span>;
    }

    if (line.event && isCommandRunMeta(line.event)) {
      const href = String(line.event.data['href']);
      const runId = readStringMeta(line.event.data['runId'], href.split('/').at(-1) ?? 'run');
      return (
        <Link
          to={href}
          className="inline-flex items-center gap-2 text-primary underline-offset-4 hover:underline"
        >
          <TerminalIcon aria-hidden className="size-3.5" />
          View run {runId}
        </Link>
      );
    }

    if (line.event && isFsListMeta(line.event)) {
      const entries = readFsListEntries(line.event);
      return (
        <div className="space-y-1">
          <span>{renderTextWithExecutableReferences(line.text)}</span>
          <div className="grid gap-1">
            {entries.map((entry) => {
              const Icon = entry.type === 'directory' ? FolderIcon : FileTextIcon;
              const nextCommand =
                entry.type === 'directory' ? `fs.list ${entry.path}` : `fs.read ${entry.path}`;
              return (
                <button
                  key={entry.path}
                  type="button"
                  className="flex min-w-0 items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-muted"
                  onClick={() => insertCommand(nextCommand)}
                  onDoubleClick={() => runCommand(nextCommand)}
                >
                  <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{entry.path}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    return <span>{renderTextWithExecutableReferences(line.text)}</span>;
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

      <Row className={styles.paneRow} align="stretch" gutterWidth={12}>
        <Col xs={12} lg="content">
          <aside className={cn('rounded-md border bg-card p-3', styles.aside)}>
            <div className="mb-3">
              <h2 className="text-sm font-medium">Actions</h2>
              <p className="text-xs text-muted-foreground">Click to paste into Run.</p>
            </div>
            <div className="grid gap-3">
              {COMMAND_ACTION_GROUPS.map((group) => {
                const Icon = group.icon;
                return (
                  <div key={group.label} className="grid gap-1">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-normal text-muted-foreground">
                      <Icon aria-hidden className="size-3.5" />
                      {group.label}
                    </div>
                    <div className="grid gap-0.5">
                      {group.actions.map((action) => (
                        <button
                          key={action.command}
                          type="button"
                          className="min-w-0 rounded py-1 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          onClick={() => insertCommand(action.command)}
                        >
                          <span className="block truncate text-sm">{action.label}</span>
                          <span className="block truncate font-mono text-xs text-primary">
                            {action.command}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        </Col>

        <Col xs={12} className={styles.mainCol}>
          <div className="flex h-full min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Output</span>
              {(['structured', 'raw', 'json'] as const).map((mode) => (
                <Button
                  key={mode}
                  type="button"
                  variant={outputMode === mode ? 'default' : 'outline'}
                  size="xs"
                  onClick={() => setOutputMode(mode)}
                >
                  {mode}
                </Button>
              ))}
            </div>

            <ScrollArea className="min-h-[52vh] flex-1 rounded-md border bg-card p-3">
              <div className="space-y-1 font-mono text-sm">
                {lines.map((line) => (
                  <div
                    key={line.id}
                    className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 whitespace-pre-wrap"
                  >
                    <span className="text-muted-foreground">{line.kind}</span>
                    {renderLine(line)}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>
          </div>
        </Col>
      </Row>

      {recentHistory.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Recent</span>
          {recentHistory.map((item) => (
            <Button key={item} type="button" variant="ghost" size="xs" onClick={() => insertCommand(item)}>
              <span className="max-w-[18rem] truncate font-mono">{item}</span>
            </Button>
          ))}
        </div>
      ) : null}

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submitCommand();
        }}
      >
        <Input
          ref={inputRef}
          aria-label="Terminal command"
          className="font-mono placeholder:text-muted-foreground/45"
          list="terminal-command-suggestions"
          placeholder={COMMAND_PLACEHOLDER}
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
        <datalist id="terminal-command-suggestions">
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
        <Button type="submit" disabled={!connected}>
          <SendIcon aria-hidden />
          Run
        </Button>
      </form>
    </section>
  );
}
