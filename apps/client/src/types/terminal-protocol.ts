export type ChatScope = 'all' | 'knowledge' | 'vault';

export interface ChatSource {
  origin: 'knowledge' | 'vault';
  title: string;
  path: string;
  score: number;
  href?: string;
  snippet: string;
}

export type Command =
  | {
      kind: 'ai.run';
      task:
        | 'route'
        | 'format'
        | 'extract'
        | 'consolidate'
        | 'code'
        | 'reason'
        | 'reason-plus'
        | 'vision'
        | 'speech';
      prompt: string;
      model?: string;
      system?: string;
      maxTokens?: number;
    }
  | {
      kind: 'chat.ask';
      question: string;
      scope?: ChatScope;
      limit?: number;
      model?: string;
      sessionId?: string;
      resetSession?: boolean;
    }
  | {
      kind: 'agent.run';
      executor?: 'llaab' | 'hermes';
      nodeId?: string;
      task?: string;
      taskId?: string;
      force?: boolean;
    }
  | {
      kind: 'cron.run';
      recipeId: string;
    }
  | {
      kind: 'fs.read';
      path: string;
    }
  | {
      kind: 'fs.list';
      path: string;
    }
  | {
      kind: 'shell.exec';
      command?: string;
      args?: string[];
      cwd?: string;
      confirmed?: boolean;
      sessionId: string;
      enableSession?: boolean;
      disableSession?: boolean;
    };

export type OutputEvent =
  | { type: 'token'; data: string }
  | { type: 'stdout'; data: string }
  | { type: 'stderr'; data: string }
  | { type: 'meta'; data: Record<string, unknown> }
  | { type: 'error'; message: string; code?: string }
  | { type: 'done'; code: number };

export interface OutputEnvelope {
  id: string;
  timestamp: string;
  event: OutputEvent;
}
