import type { ZodType } from 'zod';

export interface ControlContext {
  instructions?: string;
  data?: unknown;
  constraints?: string[];
  examples?: unknown[];
}

export interface ControlPolicy {
  maxRetries: number;
  onInvalid: 'retry' | 'reject';
  onFailure: 'retry' | 'reject';
}

export interface ControlDecision {
  type: 'accept' | 'retry' | 'reject' | 'downgrade';
  reason: string;
}

export interface ControlExecuteInput<T> {
  task: string;
  input: unknown;
  schema: ZodType<T>;
  context?: ControlContext;
  policy?: Partial<ControlPolicy>;
  run: (context?: ControlContext) => Promise<unknown>;
  model?: string;
}

export interface ControlExecuteResult<T> {
  data: T;
  attempts: number;
  decisions: ControlDecision[];
  llm?: {
    model?: string;
    rawOutput?: string;
    parsed: boolean;
  };
}
