import type {
  ControlDecision,
  ControlExecuteInput,
  ControlExecuteResult,
  ControlLlmTrace,
  ControlPolicy,
  ControlStage,
} from './types.js';

import { ControlExecutionError } from './types.js';

const DEFAULT_POLICY: ControlPolicy = {
  maxRetries: 0,
  onInvalid: 'reject',
  onFailure: 'reject',
};

function normalizePolicy(policy?: Partial<ControlPolicy>): ControlPolicy {
  return {
    ...DEFAULT_POLICY,
    ...policy,
  };
}

function toRawOutput(value: unknown): string | undefined {
  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

function shouldRetry(attempt: number, maxAttempts: number): boolean {
  return attempt < maxAttempts;
}

function buildFailedStage(
  input: ControlExecuteInput<unknown>,
  llm?: ControlLlmTrace,
  error?: string,
): ControlStage {
  return {
    name: `control:${input.task}`,
    status: 'failed',
    input: input.input,
    output: llm?.raw_output,
    error,
  };
}

export async function execute<T>(input: ControlExecuteInput<T>): Promise<ControlExecuteResult<T>> {
  const policy = normalizePolicy(input.policy);
  const maxAttempts = policy.maxRetries + 1;
  const decisions: ControlDecision[] = [];

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const output = await input.run(input.context);
      const parsed = input.schema.safeParse(output);
      const llmTrace: ControlLlmTrace = {
        model: input.model,
        raw_output: toRawOutput(output),
        parsed: parsed.success,
      };

      if (parsed.success) {
        decisions.push({
          type: 'accept',
          reason: `Schema validation passed for task "${input.task}".`,
        });

        return {
          data: parsed.data,
          attempts: attempt,
          decisions,
          llm: llmTrace,
        };
      }

      lastError = parsed.error;

      if (policy.onInvalid === 'retry' && shouldRetry(attempt, maxAttempts)) {
        decisions.push({
          type: 'retry',
          reason: `Schema validation failed for task "${input.task}" on attempt ${attempt}.`,
        });
        continue;
      }

      decisions.push({
        type: 'reject',
        reason: `Schema validation failed for task "${input.task}" and output was rejected.`,
      });
      throw new ControlExecutionError({
        message: `Schema validation failed for task "${input.task}" and output was rejected.`,
        task: input.task,
        attempts: attempt,
        decisions,
        stages: [buildFailedStage(input, llmTrace, parsed.error.message)],
        llm: llmTrace,
        cause: parsed.error,
      });
    } catch (error) {
      if (error instanceof ControlExecutionError) {
        throw error;
      }

      lastError = error;

      if (policy.onFailure === 'retry' && shouldRetry(attempt, maxAttempts)) {
        decisions.push({
          type: 'retry',
          reason: `Execution failed for task "${input.task}" on attempt ${attempt}.`,
        });
        continue;
      }

      decisions.push({
        type: 'reject',
        reason: `Execution failed for task "${input.task}" and was rejected.`,
      });
      throw new ControlExecutionError({
        message: `Execution failed for task "${input.task}" and was rejected.`,
        task: input.task,
        attempts: attempt,
        decisions,
        stages: [
          buildFailedStage(
            input,
            { model: input.model, parsed: false },
            error instanceof Error ? error.message : String(error),
          ),
        ],
        llm: {
          model: input.model,
          parsed: false,
        },
        cause: error,
      });
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Control execution failed for task "${input.task}".`);
}
