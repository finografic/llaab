import { createNode, getNodeFilePath, updateNode } from '@llaab/core';
import {
  buildRunNodeId,
  formatIsoUtcForTranscriptBody,
  formatIsoUtcSeconds,
  NodeIdSchema,
  toNodeId,
} from '@llaab/schemas';
import type { RunEvent, RunNode } from '@llaab/schemas';

export interface SkillRunRecord {
  name: string;
  /**
   * Id of the persisted run node — pass to `appendProducedNodeIds` for nodes produced after the run
   * completes.
   */
  runNodeId: string;
  startedAt: string;
  completedAt?: string;
  status: 'pending' | 'completed' | 'failed';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  /** Present when `status` is `failed` — same message persisted on the run node. */
  error?: string;
}

/**
 * Append node ids onto a persisted run's `produced_node_ids` — for nodes created by
 * follow-on processes (e.g. knowledge extraction) that complete after `persistRunNode`
 * has already written the run record.
 */
export async function appendProducedNodeIds(
  runNodeId: string,
  nodeIds: string[],
  options: { completedAt?: string } = {},
): Promise<void> {
  if (nodeIds.length === 0) return;

  const runPath = getNodeFilePath('run', runNodeId);
  await updateNode(runPath, (node) => {
    const run = node as RunNode;
    const completedAt = options.completedAt;
    return {
      ...run,
      produced_node_ids: [...new Set([...run.produced_node_ids, ...nodeIds])],
      ...(completedAt
        ? {
            completed_at: completedAt,
            duration_ms: run.started_at
              ? Date.parse(completedAt) - Date.parse(run.started_at)
              : run.duration_ms,
          }
        : {}),
    };
  });
}

/**
 * Records the LLM trace on a persisted run — for follow-on processes (e.g. knowledge extraction)
 * that call a model after `persistRunNode` has already written the run record without one.
 */
export async function setRunLlmTrace(runNodeId: string, llm: NonNullable<RunNode['llm']>): Promise<void> {
  const runPath = getNodeFilePath('run', runNodeId);
  await updateNode(runPath, (node) => ({
    ...(node as RunNode),
    llm,
  }));
}

/**
 * Appends a trace event onto a persisted run's `events` — for durable, timestamped progress
 * updates (transcript fetched, extraction started, ideas written, etc.) that the run monitor
 * displays as an activity feed while the run is still active.
 */
export async function appendRunEvent(
  runNodeId: string,
  event: Pick<RunEvent, 'level' | 'message'> & Partial<Pick<RunEvent, 'node_ids' | 'href'>>,
): Promise<void> {
  const runPath = getNodeFilePath('run', runNodeId);
  await updateNode(runPath, (node) => {
    const run = node as RunNode;
    const nextEvent: RunEvent = {
      id: `${run.events.length}-${formatIsoUtcSeconds(new Date())}`,
      at: formatIsoUtcSeconds(new Date()),
      ...event,
    };
    return {
      ...run,
      events: [...run.events, nextEvent],
    };
  });
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
    provider?: string;
    duration_ms?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
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

const SUMMARY_STRING_LIMIT = 200;
const LARGE_RUN_TEXT_LIMIT = 1000;
const LARGE_TEXT_KEYS = new Set(['body', 'plainText', 'text', 'transcript']);

/**
 * Truncates long string values before stringifying so `summarizeValue` always
 * produces syntactically valid JSON — slicing the serialized JSON text instead
 * (the previous approach) could cut off mid-string and drop closing brackets.
 */
function truncateLongStrings(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.length > SUMMARY_STRING_LIMIT ? `${value.slice(0, SUMMARY_STRING_LIMIT)}...` : value;
  }
  if (Array.isArray(value)) return value.map(truncateLongStrings);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, truncateLongStrings(val)]));
  }
  return value;
}

function compactLargeRunText(value: string) {
  return {
    omitted: true,
    reason: 'large text stored in referenced node',
    chars: value.length,
    preview: value.slice(0, SUMMARY_STRING_LIMIT),
  };
}

function compactRunValue(value: unknown): unknown {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(compactRunValue);
  if (value === null || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, val]) => {
      if (typeof val === 'string' && val.length > LARGE_RUN_TEXT_LIMIT && LARGE_TEXT_KEYS.has(key)) {
        return [key, compactLargeRunText(val)];
      }

      return [key, compactRunValue(val)];
    }),
  );
}

function summarizeValue(value: unknown): string {
  const json = JSON.stringify(truncateLongStrings(compactRunValue(value)));
  return json ?? String(value);
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

function compactRunStages(stages: NestedRunTrace['stages'] | undefined): NestedRunTrace['stages'] {
  return stages?.map((stage) => ({
    ...stage,
    input: stage.input === undefined ? undefined : compactRunValue(stage.input),
    output: stage.output === undefined ? undefined : compactRunValue(stage.output),
  }));
}

/**
 * Creates the run node immediately, before `execute()` starts, so the run monitor can show it as
 * "running" while the skill is still in progress.
 */
async function createRunningRunNode(input: {
  name: string;
  runNodeId: string;
  startedAt: string;
  rawInput: unknown;
}): Promise<void> {
  const stageInput = compactRunValue(input.rawInput);

  await createNode({
    type: 'run',
    id: input.runNodeId,
    title: `${input.name} run ${formatIsoUtcForTranscriptBody(input.startedAt)}`,
    body: '',
    tags: ['run', input.name],
    extra: {
      status: 'mature',
      skill_id: toNodeId(input.name),
      run_status: 'running',
      input_summary: summarizeValue(input.rawInput),
      produced_node_ids: [],
      started_at: input.startedAt,
      stages: [{ name: 'execute', status: 'pending', input: stageInput }],
      decisions: [],
      events: [
        {
          id: 'start',
          at: input.startedAt,
          level: 'info',
          message: `Started ${input.name}`,
        },
      ],
    },
  });
}

async function finalizeRunNode(input: {
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
  const stageInput = compactRunValue(input.rawInput);
  const stageOutput =
    input.rawOutput === undefined ? undefined : compactRunValue(stripRunTrace(input.rawOutput));
  const nestedStages = compactRunStages(input.nestedTrace?.stages);
  const runPath = getNodeFilePath('run', input.runNodeId);

  await updateNode(runPath, (node) => {
    const run = node as RunNode;
    return {
      ...run,
      run_status: input.status,
      output_summary: stageOutput === undefined ? undefined : summarizeValue(stageOutput),
      produced_node_ids: stageOutput === undefined ? [] : collectProducedNodeIds(stageOutput),
      duration_ms: Date.parse(input.completedAt) - Date.parse(input.startedAt),
      error: input.error,
      completed_at: input.completedAt,
      stages: [
        ...(nestedStages ?? []),
        {
          name: 'execute',
          status: input.status,
          input: stageInput,
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
      events: [
        ...run.events,
        {
          id: 'finish',
          at: input.completedAt,
          level: input.status === 'completed' ? 'success' : 'error',
          message:
            input.status === 'completed'
              ? `Completed ${input.name}`
              : `${input.name} failed: ${input.error ?? 'unknown error'}`,
        },
      ],
      llm: input.nestedTrace?.llm ?? run.llm,
    };
  });
}

export async function runSkill<TInput, TOutput>(
  name: string,
  execute: (input: TInput, runNodeId: string) => Promise<TOutput>,
  input: TInput,
): Promise<{ record: SkillRunRecord; result: TOutput }> {
  const startTime = new Date();
  const startedAt = formatIsoUtcSeconds(startTime);
  const runNodeId = buildRunNodeId(name, startTime);

  await createRunningRunNode({ name, runNodeId, startedAt, rawInput: input });

  try {
    const result = await execute(input, runNodeId);
    const completedAt = formatIsoUtcSeconds(new Date());
    const nestedTrace = extractNestedRunTrace(result);
    const publicResult = stripRunTrace(result);

    await finalizeRunNode({
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
        runNodeId,
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

    await finalizeRunNode({
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
        runNodeId,
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
