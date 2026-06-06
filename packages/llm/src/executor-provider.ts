import type { Capability } from '@llaab/core';

export interface ExecutionPlan {
  instructions: string;
  task: string;
  confirmed?: boolean;
  constraints?: string[];
  context?: unknown;
  cwd?: string;
  model?: string;
  title?: string;
}

export interface ExecutionResult {
  command: string[];
  durationMs: number;
  exitCode: number;
  fallbackReason?: string;
  model?: string;
  provider: string;
  stderr: string;
  stdout: string;
}

export interface ExecutorProvider {
  readonly id: string;
  readonly displayName: string;
  readonly capabilities: Capability[];
  readonly requiresConfirmation: boolean;
  isAvailable(): Promise<boolean>;
  run(plan: ExecutionPlan): Promise<ExecutionResult>;
}
