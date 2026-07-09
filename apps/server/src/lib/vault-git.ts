import { spawn } from 'node:child_process';
import { sep } from 'node:path';
import { VAULT_ROOT } from '@llaab/core';
import { formatNodeFilename } from '@llaab/schemas';

export function buildAutoSourceMetadataCommitMessage(sourceTitle: string): string {
  return `chore(vault-auto): refresh source metadata for ${sourceTitle}`;
}

export interface AutoCommitSourceMetadataResult {
  committed: boolean;
  skipped?: boolean;
  sha?: string;
  error?: string;
}

/** Auto-commit a tracked source file after enrich metadata refresh. Skips untracked sources. */
export async function autoCommitTrackedSourceMetadata(
  sourceId: string,
  sourceTitle: string,
): Promise<AutoCommitSourceMetadataResult> {
  const relativePath = `sources/${formatNodeFilename('source', sourceId)}`;

  try {
    if (!(await isVaultFileTracked(relativePath))) {
      return { committed: false, skipped: true };
    }

    const commitResult = await commitVaultFile(
      relativePath,
      buildAutoSourceMetadataCommitMessage(sourceTitle),
      {
        skipHooks: true,
      },
    );

    return {
      committed: !commitResult.skipped,
      skipped: commitResult.skipped,
      sha: commitResult.sha,
    };
  } catch (error) {
    return {
      committed: false,
      error: error instanceof Error ? error.message : 'Failed to auto-commit source metadata refresh.',
    };
  }
}

export function runGit(args: string[]): Promise<{ exitCode: number; stderr: string; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd: VAULT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
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
    child.on('close', (code) => resolve({ exitCode: code ?? 1, stderr, stdout }));
  });
}

/** Path relative to vault/ (e.g. `sources/source.theo-t3-gg.md`) → vault repo path for git. */
export function toVaultGitPath(pathRelativeToVault: string): string {
  const normalizedPath = pathRelativeToVault.replaceAll('\\', '/');
  const segments = normalizedPath.split('/');
  if (
    normalizedPath.startsWith('/') ||
    normalizedPath.includes('\0') ||
    segments.includes('..') ||
    segments.includes('')
  ) {
    throw new Error('Invalid path.');
  }

  return segments.join(sep);
}

/** True when the file is already tracked in git (committed or staged). Untracked nodes return false. */
export async function isVaultFileTracked(pathRelativeToVault: string): Promise<boolean> {
  const gitPath = toVaultGitPath(pathRelativeToVault);
  const result = await runGit(['ls-files', '--error-unmatch', '--', gitPath]);
  return result.exitCode === 0;
}

let gitOperationChain: Promise<unknown> = Promise.resolve();

export function withVaultGitLock<T>(operation: () => Promise<T>): Promise<T> {
  const next = gitOperationChain.then(operation, operation);
  gitOperationChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export interface CommitVaultFileOptions {
  /** Skip git hooks (e.g. lint-staged) for machine-generated chore commits. */
  skipHooks?: boolean;
}

export async function commitVaultFile(
  pathRelativeToVault: string,
  message: string,
  options: CommitVaultFileOptions = {},
): Promise<{ sha?: string; skipped?: boolean }> {
  return withVaultGitLock(async () => {
    const gitPath = toVaultGitPath(pathRelativeToVault);

    const add = await runGit(['add', '--', gitPath]);
    if (add.exitCode !== 0) {
      throw new Error(add.stderr || 'git add failed.');
    }

    const diff = await runGit(['diff', '--cached', '--quiet', '--', gitPath]);
    if (diff.exitCode === 0) {
      return { skipped: true };
    }

    const commitArgs = ['commit', '-m', message, '--', gitPath];
    if (options.skipHooks) {
      commitArgs.splice(1, 0, '--no-verify');
    }

    const commit = await runGit(commitArgs);
    if (commit.exitCode !== 0) {
      throw new Error(commit.stderr || 'git commit failed.');
    }

    const rev = await runGit(['rev-parse', 'HEAD']);
    return { sha: rev.exitCode === 0 ? rev.stdout.trim() : undefined };
  });
}
