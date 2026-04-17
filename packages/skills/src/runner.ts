import { createNode } from '@llaab/core';
import { buildRunNodeId, formatIsoUtcSeconds, NodeIdSchema, toNodeId } from '@llaab/schemas';

export interface SkillRunRecord {
  name: string;
  startedAt: string;
  completedAt?: string;
  status: 'pending' | 'completed' | 'failed';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  /** Present when `status` is `failed` — same message persisted on the run node. */
  error?: string;
}

interface NestedRunTrace {
  stages?: Array<{
    name: string;
    status: 'pending' | 'completed' | 'failed';
    input?: unknown;
    output?: unknown;
    error?: string;
  }>;
  decisions?: Array<{
    type: 'accept' | 'retry' | 'reject' | 'downgrade';
    reason: string;
  }>;
  llm?: {
    model?: string;
    raw_output?: string;
    parsed?: boolean;
  };
}

function extractNestedRunTrace(value: unknown): NestedRunTrace | undefined {
  if (!value || typeof value !== 'object' || !('runTrace' in value)) {
    return undefined;
  }

  const candidate = value.runTrace;

  if (!candidate || typeof candidate !== 'object') {
    return undefined;
  }

  return candidate as NestedRunTrace;
}

function extractNestedRunTraceFromError(error: unknown): NestedRunTrace | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidate = error as {
    stages?: NestedRunTrace['stages'];
    decisions?: NestedRunTrace['decisions'];
    llm?: NestedRunTrace['llm'];
  };

  if (!candidate.stages && !candidate.decisions && !candidate.llm) {
    return undefined;
  }

  return {
    stages: candidate.stages,
    decisions: candidate.decisions,
    llm: candidate.llm,
  };
}

function stripRunTrace<T>(value: T): T {
  if (!value || typeof value !== 'object' || !('runTrace' in (value as Record<string, unknown>))) {
    return value;
  }

  const { runTrace: _runTrace, ...rest } = value as Record<string, unknown>;
  return rest as T;
}

function summarizeValue(value: unknown): string {
  const json = JSON.stringify(value);
  if (!json) return String(value);
  return json.length > 400 ? `${json.slice(0, 397)}...` : json;
}

function collectProducedNodeIds(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];

  if ('producedNodeIds' in value && Array.isArray(value.producedNodeIds)) {
    return value.producedNodeIds.filter((item): item is string => NodeIdSchema.safeParse(item).success);
  }

  if ('id' in value && typeof value.id === 'string' && NodeIdSchema.safeParse(value.id).success) {
    return [value.id];
  }

  return [];
}

async function persistRunNode(input: {
  name: string;
  runNodeId: string;
  startedAt: string;
  completedAt: string;
  status: 'completed' | 'failed';
  rawInput: unknown;
  rawOutput?: unknown;
  error?: string;
  nestedTrace?: NestedRunTrace;
}): Promise<void> {
  const stageOutput = input.rawOutput === undefined ? undefined : stripRunTrace(input.rawOutput);

  await createNode({
    type: 'run',
    id: input.runNodeId,
    title: `${input.name} run ${input.startedAt}`,
    body: '',
    tags: ['run', input.name],
    extra: {
      status: 'mature',
      skill_id: toNodeId(input.name),
      run_status: input.status,
      input_summary: summarizeValue(input.rawInput),
      output_summary: stageOutput === undefined ? undefined : summarizeValue(stageOutput),
      produced_node_ids: stageOutput === undefined ? [] : collectProducedNodeIds(stageOutput),
      duration_ms: Date.parse(input.completedAt) - Date.parse(input.startedAt),
      error: input.error,
      started_at: input.startedAt,
      completed_at: input.completedAt,
      stages: [
        ...(input.nestedTrace?.stages ?? []),
        {
          name: 'execute',
          status: input.status,
          input: input.rawInput,
          output: stageOutput,
          error: input.error,
        },
      ],
      decisions: [
        ...(input.nestedTrace?.decisions ?? []),
        {
          type: input.status === 'completed' ? 'accept' : 'reject',
          reason:
            input.status === 'completed'
              ? 'Skill execution completed and output was accepted.'
              : 'Skill execution failed before producing an acceptable output.',
        },
      ],
      llm: input.nestedTrace?.llm,
    },
  });
}

export async function runSkill<TInput, TOutput>(
  name: string,
  execute: (input: TInput) => Promise<TOutput>,
  input: TInput,
): Promise<{ record: SkillRunRecord; result: TOutput }> {
  const startTime = new Date();
  const startedAt = formatIsoUtcSeconds(startTime);
  const runNodeId = buildRunNodeId(name, startTime);
  try {
    const result = await execute(input);
    const completedAt = formatIsoUtcSeconds(new Date());
    const nestedTrace = extractNestedRunTrace(result);
    const publicResult = stripRunTrace(result);

    await persistRunNode({
      name,
      runNodeId,
      startedAt,
      completedAt,
      status: 'completed',
      rawInput: input,
      rawOutput: publicResult,
      nestedTrace,
    });

    return {
      record: {
        name,
        startedAt,
        completedAt,
        status: 'completed',
        input: input as Record<string, unknown>,
        output: publicResult as Record<string, unknown>,
      },
      result: publicResult,
    };
  } catch (error) {
    const completedAt = formatIsoUtcSeconds(new Date());
    const nestedTrace = extractNestedRunTraceFromError(error);

    await persistRunNode({
      name,
      runNodeId,
      startedAt,
      completedAt,
      status: 'failed',
      rawInput: input,
      error: error instanceof Error ? error.message : String(error),
      nestedTrace,
    });

    return {
      record: {
        name,
        startedAt,
        completedAt,
        status: 'failed',
        input: input as Record<string, unknown>,
        error: error instanceof Error ? error.message : String(error),
      },
      result: {} as TOutput,
    };
  }
}
