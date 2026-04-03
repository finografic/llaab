export interface SkillRunRecord {
  name: string;
  startedAt: string;
  completedAt?: string;
  status: 'pending' | 'completed' | 'failed';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
}

export async function runSkill<TInput, TOutput>(
  name: string,
  execute: (input: TInput) => Promise<TOutput>,
  input: TInput,
): Promise<{ record: SkillRunRecord; result: TOutput }> {
  const startedAt = new Date().toISOString();
  try {
    const result = await execute(input);
    return {
      record: {
        name,
        startedAt,
        completedAt: new Date().toISOString(),
        status: 'completed',
        input: input as Record<string, unknown>,
        output: result as Record<string, unknown>,
      },
      result,
    };
  } catch {
    return {
      record: {
        name,
        startedAt,
        completedAt: new Date().toISOString(),
        status: 'failed',
        input: input as Record<string, unknown>,
      },
      result: {} as TOutput,
    };
  }
}
