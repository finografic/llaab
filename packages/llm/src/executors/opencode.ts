import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ExecutionPlan, ExecutionResult, ExecutorProvider } from '../executor-provider.js';

async function runProcess(
  command: string,
  args: string[],
  options: { cwd?: string; input?: string } = {},
): Promise<{ exitCode: number; stderr: string; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ exitCode: code ?? 1, stderr, stdout });
    });

    if (options.input) {
      child.stdin.end(options.input);
    } else {
      child.stdin.end();
    }
  });
}

function buildPrompt(plan: ExecutionPlan, contextPath: string): string {
  return [
    plan.instructions,
    '',
    `Context bundle: ${contextPath}`,
    ...(plan.constraints?.length
      ? ['', 'Constraints:', ...plan.constraints.map((constraint) => `- ${constraint}`)]
      : []),
  ].join('\n');
}

export const opencodeExecutor: ExecutorProvider = {
  id: 'opencode',
  displayName: 'OpenCode',
  capabilities: ['code_edit', 'shell_exec', 'test_run'],
  requiresConfirmation: true,
  async isAvailable() {
    try {
      const result = await runProcess('which', ['opencode']);
      return result.exitCode === 0 && result.stdout.trim().length > 0;
    } catch {
      return false;
    }
  },
  async run(plan: ExecutionPlan): Promise<ExecutionResult> {
    if (!plan.confirmed) {
      throw new Error('OpenCode execution requires explicit confirmation.');
    }

    const start = performance.now();
    const tempDir = await mkdtemp(join(tmpdir(), 'llaab-opencode-'));
    const contextPath = join(tempDir, 'context.json');
    const contextBundle = {
      constraints: plan.constraints ?? [],
      context: plan.context ?? null,
      task: plan.task,
    };

    try {
      await writeFile(contextPath, JSON.stringify(contextBundle, null, 2), 'utf8');
      const prompt = buildPrompt(plan, contextPath);
      const command = [
        'opencode',
        'run',
        '--format',
        'json',
        '--file',
        contextPath,
        ...(plan.model ? ['--model', plan.model] : []),
        ...(plan.title ? ['--title', plan.title] : []),
        ...(plan.cwd ? ['--dir', plan.cwd] : []),
        prompt,
      ];
      const result = await runProcess(command[0] as string, command.slice(1), {
        cwd: plan.cwd,
      });

      return {
        command,
        durationMs: Math.round(performance.now() - start),
        exitCode: result.exitCode,
        model: plan.model,
        provider: 'opencode',
        stderr: result.stderr,
        stdout: result.stdout,
      };
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  },
};
