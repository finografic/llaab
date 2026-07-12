import { cn } from '@llaab/ui/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from 'components/ui/accordion';
import { Badge } from 'components/ui/badge';
import { Button } from 'components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from 'components/ui/collapsible';
import { Col, Row } from 'components/ui/grid';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from 'components/ui/input-group';
import { ScrollArea } from 'components/ui/scroll-area';
import { FileTextIcon, FolderIcon, SendIcon, TerminalIcon, XIcon } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { TerminalAction } from './terminal-panel.constants';

import type { OutputEnvelope, OutputEvent } from 'types/terminal-protocol';

import {
  COMMAND_ACTION_GROUPS,
  COMMAND_PLACEHOLDER,
  DEFAULT_ACTION_GROUP_ID,
  HISTORY_STORAGE_KEY,
} from './terminal-panel.constants';
import {
  commandForReference,
  eventText,
  findExecutableReference,
  isCommandRunMeta,
  isFsListMeta,
  parseTerminalCommand,
  readFsListEntries,
  readShellSessionEnabled,
  readStringMeta,
  websocketUrl,
} from './terminal-panel.utils';
import styles from './TerminalPanel.module.css';

type OutputMode = 'structured' | 'raw' | 'json';

interface TerminalLine {
  id: string;
  cmdId?: string;
  kind: 'input' | OutputEvent['type'] | 'system';
  text: string;
  event?: OutputEvent;
}

function lineKindClassName(kind: TerminalLine['kind']) {
  if (kind === 'error') return styles.lineKindError;
  return styles.lineKind;
}

function TerminalActionButton({
  action,
  variant,
  onSelect,
}: {
  action: TerminalAction;
  variant: 'accordion' | 'detail';
  onSelect: (command: string) => void;
}) {
  return (
    <button
      type="button"
      className={cn(styles.actionButton, variant === 'detail' && styles.detailActionButton)}
      onClick={() => onSelect(action.command)}
    >
      <span className={styles.actionLabel}>{action.label}</span>
      {variant === 'detail' ? <span className={styles.detailActionCommand}>{action.command}</span> : null}
    </button>
  );
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
  const [shellSessionEnabled, setShellSessionEnabled] = useState(false);
  const [outputMode, setOutputMode] = useState<OutputMode>('structured');
  const [activeGroupId, setActiveGroupId] = useState(DEFAULT_ACTION_GROUP_ID);
  const [activeGroupPanelOpen, setActiveGroupPanelOpen] = useState(true);
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

  const activeGroup = useMemo(
    () => COMMAND_ACTION_GROUPS.find((group) => group.id === activeGroupId),
    [activeGroupId],
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
      const shellSessionUpdate = readShellSessionEnabled(envelope.event, shellSessionIdRef.current);
      if (shellSessionUpdate !== null) {
        setShellSessionEnabled(shellSessionUpdate);
      }
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
    const maxIndex = history.length;

    if (maxIndex === 0) {
      setHistoryIndex(0);
      setCommand('');
      return;
    }

    if (direction === 'older') {
      if (historyIndex === null || historyIndex === 0) {
        setHistoryIndex(1);
        setCommand(history[0] ?? '');
        return;
      }
      if (historyIndex >= maxIndex) return;
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setCommand(history[nextIndex - 1] ?? '');
      return;
    }

    if (historyIndex === null) return;
    if (historyIndex <= 0) return;

    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    setCommand(nextIndex === 0 ? '' : (history[nextIndex - 1] ?? ''));
  }

  function insertCommand(nextCommand: string) {
    setCommand(nextCommand);
    setHistoryIndex(null);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }

  function runCommand(nextCommand: string) {
    setCommand(nextCommand);
    submitCommand(nextCommand);
  }

  function clearCommand() {
    setCommand('');
    setHistoryIndex(null);
    inputRef.current?.focus();
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
      return <span className={line.kind === 'error' ? styles.lineErrorText : undefined}>{line.text}</span>;
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

    if (line.kind === 'error') {
      return <span className={styles.lineErrorText}>{renderTextWithExecutableReferences(line.text)}</span>;
    }

    return <span>{renderTextWithExecutableReferences(line.text)}</span>;
  }

  return (
    <section className={styles.root}>
      <div className={styles.paneShell}>
        <Row className={styles.paneRow} align="stretch" gutterWidth={12}>
          <Col xs={12} lg="content" className={styles.asideCol}>
            <aside className={cn('rounded-md border bg-card p-3', styles.aside)}>
              <div className={styles.asideHeader}>
                <h2 className={styles.asideHeaderTitle}>Actions</h2>
                <p className={styles.asideHeaderHint}>Click to paste into Run.</p>
              </div>
              <Accordion
                type="single"
                collapsible
                value={activeGroupId}
                onValueChange={setActiveGroupId}
                className={styles.asideAccordion}
              >
                {COMMAND_ACTION_GROUPS.map((group) => {
                  const Icon = group.icon;
                  return (
                    <AccordionItem key={group.id} value={group.id} className={styles.accordionItem}>
                      <AccordionTrigger className={styles.groupTrigger}>
                        <Icon aria-hidden className={styles.groupTitleIcon} />
                        <span>{group.label}</span>
                      </AccordionTrigger>
                      <AccordionContent className={styles.groupContent}>
                        <div className={styles.groupActionList}>
                          {group.actions.map((action) => (
                            <TerminalActionButton
                              key={action.command}
                              action={action}
                              variant="accordion"
                              onSelect={insertCommand}
                            />
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </aside>
          </Col>

          <Col xs={12} className={styles.mainCol}>
            <div className={styles.terminalColumn}>
              <div className={styles.outputModeRow}>
                <span className={styles.outputLabel}>Output:</span>
                {(['structured', 'raw', 'json'] as const).map((mode) => (
                  <Button
                    key={mode}
                    type="button"
                    variant={outputMode === mode ? 'default' : 'outline'}
                    size="xs"
                    className={styles.outputModeButton}
                    onClick={() => setOutputMode(mode)}
                  >
                    {mode}
                  </Button>
                ))}
                <div className={styles.statusBadges}>
                  <Badge
                    variant="outline"
                    className={
                      shellSessionEnabled ? styles.statusShellSessionOn : styles.statusShellSessionOff
                    }
                  >
                    shell session
                  </Badge>
                  <Badge
                    variant={connected ? 'outline' : 'secondary'}
                    className={connected ? styles.statusConnected : undefined}
                  >
                    {connected ? 'connected' : 'offline'}
                  </Badge>
                </div>
              </div>

              <div className={styles.outputShell}>
                <ScrollArea className={styles.output}>
                  <div className={styles.outputLines}>
                    {lines.map((line, index) => {
                      const showCommandSeparator =
                        line.kind === 'input' &&
                        lines.slice(0, index).some((previousLine) => previousLine.kind === 'input');

                      return (
                        <Fragment key={line.id}>
                          {showCommandSeparator ? (
                            <div className={styles.commandSeparator} role="separator" aria-hidden />
                          ) : null}
                          <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 whitespace-pre-wrap">
                            <span className={lineKindClassName(line.kind)}>{line.kind}</span>
                            {renderLine(line)}
                          </div>
                        </Fragment>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                </ScrollArea>
              </div>

              <form
                autoComplete="off"
                className={styles.commandForm}
                onSubmit={(event) => {
                  event.preventDefault();
                  submitCommand();
                }}
              >
                <InputGroup className={styles.commandInputGroup}>
                  <InputGroupAddon align="inline-start">
                    <InputGroupButton
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className={styles.clearInputButton}
                      aria-label="Clear command"
                      disabled={command.length === 0}
                      onClick={clearCommand}
                    >
                      <XIcon aria-hidden />
                    </InputGroupButton>
                  </InputGroupAddon>
                  <InputGroupInput
                    ref={inputRef}
                    aria-label="Terminal command"
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    className={styles.commandInput}
                    name="llaab-terminal-command"
                    placeholder={COMMAND_PLACEHOLDER}
                    spellCheck={false}
                    value={command}
                    onChange={(event) => {
                      setCommand(event.target.value);
                      setHistoryIndex(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        event.stopPropagation();
                        recallHistory('older');
                      }
                      if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        event.stopPropagation();
                        recallHistory('newer');
                      }
                    }}
                  />
                </InputGroup>
                <Button type="submit" disabled={!connected} className={styles.runButton}>
                  <SendIcon aria-hidden />
                  Run
                </Button>
              </form>

              {activeGroup ? (
                <Collapsible
                  open={activeGroupPanelOpen}
                  onOpenChange={setActiveGroupPanelOpen}
                  className={styles.activeGroupPanel}
                  aria-label={`${activeGroup.label} commands`}
                >
                  <CollapsibleTrigger className={styles.activeGroupTitle}>
                    <activeGroup.icon aria-hidden className={styles.activeGroupTitleIcon} />
                    <span>{activeGroup.label}</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className={styles.activeGroupActions}>
                    {activeGroup.actions.map((action) => (
                      <TerminalActionButton
                        key={action.command}
                        action={action}
                        variant="detail"
                        onSelect={insertCommand}
                      />
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              ) : null}
            </div>
          </Col>
        </Row>
      </div>
    </section>
  );
}
