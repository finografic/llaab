import {
  BotIcon,
  ListTreeIcon,
  MessagesSquareIcon,
  SparklesIcon,
  TerminalIcon,
  TimerIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface TerminalAction {
  label: string;
  command: string;
}

export interface TerminalActionGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  actions: TerminalAction[];
}

export const DEFAULT_ACTION_GROUP_ID = 'chat';

export const HISTORY_STORAGE_KEY = 'llaab-terminal-history';

export const COMMAND_PLACEHOLDER = 'Type a command, or choose an action';

export const COMMAND_SUGGESTIONS = [
  'chat.ask "Give me info on how to write a harness well."',
  'chat.ask "What did I capture about context engineering?" --scope vault',
  'chat.ask "Summarise my canonical ideas on agent execution." --scope knowledge',
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
] as const;

export const EXECUTABLE_COMMAND_REFERENCES = [
  'chat.ask',
  'shell.exec --enable-session --confirm',
  'shell.exec --disable-session',
  'shell.exec --confirm',
  'agent.run',
  'cron.run',
  'ai.run',
  'fs.read',
  'fs.list',
  'shell.exec',
] as const;

export const COMMAND_ACTION_GROUPS: TerminalActionGroup[] = [
  {
    id: 'chat',
    label: 'Chat',
    icon: MessagesSquareIcon,
    actions: [
      { label: 'Ask the vault', command: 'chat.ask "How do I write a harness well?"' },
      {
        label: 'Ask knowledge only',
        command: 'chat.ask "What are my canonical ideas on agent execution?" --scope knowledge',
      },
      {
        label: 'Ask vault captures only',
        command: 'chat.ask "What did I capture about context engineering?" --scope vault',
      },
      { label: 'Start a fresh thread', command: 'chat.ask "New question." --reset' },
    ],
  },
  {
    id: 'vault',
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
    id: 'ai',
    label: 'AI',
    icon: SparklesIcon,
    actions: [
      { label: 'Extract ideas', command: 'ai.run extract "Extract three reusable ideas from this note."' },
      { label: 'Reason through decision', command: 'ai.run reason "Think through this decision."' },
    ],
  },
  {
    id: 'agents',
    label: 'Agents',
    icon: BotIcon,
    actions: [
      { label: 'Run LLAAB agent', command: 'agent.run --executor llaab --force' },
      { label: 'Prepare Hermes task', command: 'agent.run --executor hermes --task inbox-triage' },
    ],
  },
  {
    id: 'crons',
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
    id: 'shell',
    label: 'Shell',
    icon: TerminalIcon,
    actions: [
      { label: 'Enable shell session', command: 'shell.exec --enable-session --confirm' },
      { label: 'Node version', command: 'shell.exec --confirm node --version' },
      { label: 'Disable shell session', command: 'shell.exec --disable-session' },
    ],
  },
];

export const COMMAND_ACTIONS = COMMAND_ACTION_GROUPS.flatMap((group) => group.actions);
