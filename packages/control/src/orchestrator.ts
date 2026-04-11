import { ZodError } from 'zod';
import type { ControlDecision, ControlExecuteInput, ControlExecuteResult, ControlPolicy } from './types.js';

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

export async function execute<T>(input: ControlExecuteInput<T>): Promise<ControlExecuteResult<T>> {
  const policy = normalizePolicy(input.policy);
  const maxAttempts = policy.maxRetries + 1;
  const decisions: ControlDecision[] = [];

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const output = await input.run(input.context);
      const parsed = input.schema.safeParse(output);

      if (parsed.success) {
        decisions.push({
          type: 'accept',
          reason: `Schema validation passed for task "${input.task}".`,
        });

        return {
          data: parsed.data,
          attempts: attempt,
          decisions,
          llm: {
            model: input.model,
            rawOutput: toRawOutput(output),
            parsed: true,
          },
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
      throw parsed.error;
    } catch (error) {
      if (error instanceof ZodError) {
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
      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Control execution failed for task "${input.task}".`);
}
