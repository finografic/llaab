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

export interface ControlStage {
  name: string;
  status: 'pending' | 'completed' | 'failed';
  input?: unknown;
  output?: unknown;
  error?: string;
}

export interface ControlLlmTrace {
  model?: string;
  provider?: string;
  duration_ms?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  raw_output?: string;
  parsed: boolean;
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
  llm?: ControlLlmTrace;
}

export interface ControlExecutionErrorInput {
  message: string;
  task: string;
  attempts: number;
  decisions: ControlDecision[];
  stages: ControlStage[];
  llm?: ControlLlmTrace;
  cause?: unknown;
}

export class ControlExecutionError extends Error {
  readonly task: string;
  readonly attempts: number;
  readonly decisions: ControlDecision[];
  readonly stages: ControlStage[];
  readonly llm?: ControlLlmTrace;

  constructor(input: ControlExecutionErrorInput) {
    super(input.message, input.cause === undefined ? undefined : { cause: input.cause });
    this.name = 'ControlExecutionError';
    this.task = input.task;
    this.attempts = input.attempts;
    this.decisions = input.decisions;
    this.stages = input.stages;
    this.llm = input.llm;
  }
}
