import { spawn } from 'node:child_process';
import { sep } from 'node:path';
import { MONOREPO_ROOT } from '@llaab/core';
import { NodeTypeSchema } from '@llaab/schemas';
import type { AppCtx } from '../../types/app.types.js';
import type {
  NodeType,
  VaultGitFileStatus,
  VaultGitStatusEntry,
  VaultGitStatusResponse,
} from '@llaab/schemas';

function runGit(args: string[]): Promise<{ exitCode: number; stderr: string; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd: MONOREPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
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
    child.on('close', (code) => resolve({ exitCode: code ?? 1, stderr, stdout }));
  });
}

function mapPorcelainCode(code: string): VaultGitFileStatus {
  if (code.includes('?')) return 'untracked';
  if (code.includes('A')) return 'added';
  if (code.includes('D')) return 'deleted';
  if (code.includes('R')) return 'renamed';
  return 'modified';
}

function parsePorcelainEntries(stdout: string): Array<{ code: string; path: string }> {
  return stdout
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => {
      const code = line.slice(0, 2);
      const rest = line.slice(3);
      const renameParts = rest.split(' -> ');
      return { code, path: renameParts[renameParts.length - 1]! };
    });
}

function categorizeVaultPath(relativePath: string): NodeType | undefined {
  const basename = relativePath.split('/').pop() ?? '';
  const prefix = basename.split('.')[0] ?? '';
  const parsed = NodeTypeSchema.safeParse(prefix);
  return parsed.success ? parsed.data : undefined;
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function buildVaultCommitMessage(countsByType: Record<string, number>, total: number): string {
  const header = `chore(vault): commit ${pluralize(total, 'file')}`;
  const lines = Object.entries(countsByType)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, count]) => `- ${pluralize(count, `${type} file`)}`);

  return lines.length > 0 ? `${header}\n\n${lines.join('\n')}` : header;
}

function toVaultGitPath(path: string): string {
  const normalizedPath = path.replaceAll('\\', '/');
  const segments = normalizedPath.split('/');
  if (
    normalizedPath.startsWith('/') ||
    normalizedPath.includes('\0') ||
    segments.includes('..') ||
    segments.includes('')
  ) {
    throw new Error('Invalid path.');
  }

  return ['vault', ...segments].join(sep);
}

async function getVaultGitStatus(): Promise<VaultGitStatusResponse> {
  const status = await runGit(['status', '--porcelain=v1', '--', 'vault']);
  if (status.exitCode !== 0) {
    throw new Error(status.stderr || 'git status failed.');
  }

  const entries: VaultGitStatusEntry[] = parsePorcelainEntries(status.stdout).map(({ code, path }) => {
    const relativeToVault = path.startsWith('vault/') ? path.slice('vault/'.length) : path;
    return {
      path: relativeToVault,
      status: mapPorcelainCode(code),
      nodeType: categorizeVaultPath(relativeToVault),
    };
  });

  const countsByType: Record<string, number> = {};
  for (const entry of entries) {
    const key = entry.nodeType ?? 'other';
    countsByType[key] = (countsByType[key] ?? 0) + 1;
  }

  return {
    entries,
    totalCount: entries.length,
    countsByType,
    commitMessage: buildVaultCommitMessage(countsByType, entries.length),
  };
}

export const vaultGitStatus = {
  path: '/git/status' as const,
  handler: async (c: AppCtx) => {
    try {
      return c.json(await getVaultGitStatus());
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Failed to load vault git status.' }, 500);
    }
  },
};

export const vaultGitDiff = {
  path: '/git/diff' as const,
  handler: async (c: AppCtx) => {
    const filePath = c.req.query('path');
    if (!filePath) return c.json({ error: '`path` query parameter is required.' }, 400);

    let gitPath: string;
    try {
      gitPath = toVaultGitPath(filePath);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Invalid path.' }, 403);
    }

    try {
      const diff = await runGit(['diff', '--no-ext-diff', '--unified=80', 'HEAD', '--', gitPath]);
      if (diff.exitCode !== 0) {
        throw new Error(diff.stderr || 'git diff failed.');
      }

      return c.json({ patch: diff.stdout });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Failed to load vault diff.' }, 500);
    }
  },
};

export const vaultGitCommit = {
  path: '/git/commit' as const,
  handler: async (c: AppCtx) => {
    try {
      const status = await getVaultGitStatus();
      if (status.totalCount === 0) {
        return c.json({ error: 'No vault changes to commit.' }, 400);
      }

      const add = await runGit(['add', '--', 'vault']);
      if (add.exitCode !== 0) {
        throw new Error(add.stderr || 'git add failed.');
      }

      const commit = await runGit(['commit', '-m', status.commitMessage, '--', 'vault']);
      if (commit.exitCode !== 0) {
        throw new Error(commit.stderr || 'git commit failed.');
      }

      const rev = await runGit(['rev-parse', 'HEAD']);

      return c.json({
        committedCount: status.totalCount,
        commitMessage: status.commitMessage,
        sha: rev.exitCode === 0 ? rev.stdout.trim() : undefined,
      });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Failed to commit vault changes.' }, 500);
    }
  },
};

export const vaultGitReset = {
  path: '/git/reset' as const,
  handler: async (c: AppCtx) => {
    try {
      const status = await getVaultGitStatus();
      if (status.totalCount === 0) {
        return c.json({ error: 'No vault changes to reset.' }, 400);
      }

      // Discard tracked modifications/deletions under vault/ back to the last commit...
      const checkout = await runGit(['checkout', 'HEAD', '--', 'vault']);
      if (checkout.exitCode !== 0) {
        throw new Error(checkout.stderr || 'git checkout failed.');
      }

      // ...then remove untracked vault/ files and dirs (new, never-committed nodes).
      const clean = await runGit(['clean', '-fd', '--', 'vault']);
      if (clean.exitCode !== 0) {
        throw new Error(clean.stderr || 'git clean failed.');
      }

      return c.json({ resetCount: status.totalCount });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Failed to reset vault changes.' }, 500);
    }
  },
};
