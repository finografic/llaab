import { createNode } from '@llaab/core';
import { NodeIdSchema, toNodeId } from '@llaab/schemas';

export interface SkillRunRecord {
  name: string;
  startedAt: string;
  completedAt?: string;
  status: 'pending' | 'completed' | 'failed';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
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
  startedAt: string;
  completedAt: string;
  status: 'completed' | 'failed';
  rawInput: unknown;
  rawOutput?: unknown;
  error?: string;
}): Promise<void> {
  await createNode({
    type: 'run',
    title: `${input.name} run ${input.startedAt}`,
    body: '',
    tags: ['run', input.name],
    extra: {
      status: 'mature',
      skillId: toNodeId(input.name),
      runStatus: input.status,
      inputSummary: summarizeValue(input.rawInput),
      outputSummary: input.rawOutput === undefined ? undefined : summarizeValue(input.rawOutput),
      producedNodeIds: input.rawOutput === undefined ? [] : collectProducedNodeIds(input.rawOutput),
      durationMs: Date.parse(input.completedAt) - Date.parse(input.startedAt),
      error: input.error,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      stages: [
        {
          name: 'execute',
          status: input.status,
          input: input.rawInput,
          output: input.rawOutput,
          error: input.error,
        },
      ],
      decisions: [
        {
          type: input.status === 'completed' ? 'accept' : 'reject',
          reason:
            input.status === 'completed'
              ? 'Skill execution completed and output was accepted.'
              : 'Skill execution failed before producing an acceptable output.',
        },
      ],
    },
  });
}

export async function runSkill<TInput, TOutput>(
  name: string,
  execute: (input: TInput) => Promise<TOutput>,
  input: TInput,
): Promise<{ record: SkillRunRecord; result: TOutput }> {
  const startedAt = new Date().toISOString();
  try {
    const result = await execute(input);
    const completedAt = new Date().toISOString();

    await persistRunNode({
      name,
      startedAt,
      completedAt,
      status: 'completed',
      rawInput: input,
      rawOutput: result,
    });

    return {
      record: {
        name,
        startedAt,
        completedAt,
        status: 'completed',
        input: input as Record<string, unknown>,
        output: result as Record<string, unknown>,
      },
      result,
    };
  } catch (error) {
    const completedAt = new Date().toISOString();

    await persistRunNode({
      name,
      startedAt,
      completedAt,
      status: 'failed',
      rawInput: input,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      record: {
        name,
        startedAt,
        completedAt,
        status: 'failed',
        input: input as Record<string, unknown>,
      },
      result: {} as TOutput,
    };
  }
}
