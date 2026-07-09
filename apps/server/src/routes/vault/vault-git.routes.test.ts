import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('vault-git routes', () => {
  const originalVaultRoot = process.env.LLAAB_VAULT;

  afterEach(() => {
    if (originalVaultRoot === undefined) {
      delete process.env.LLAAB_VAULT;
    } else {
      process.env.LLAAB_VAULT = originalVaultRoot;
    }
    vi.resetModules();
  });

  it('reads git status from the nested vault repo root', async () => {
    const vaultRoot = await mkdtemp(join(tmpdir(), 'llaab-vault-git-'));
    process.env.LLAAB_VAULT = vaultRoot;
    vi.resetModules();

    const { runGit } = await import('../../lib/vault-git.js');
    const init = await runGit(['init']);
    expect(init.exitCode).toBe(0);

    await mkdir(join(vaultRoot, 'nodes', 'ideas'), { recursive: true });
    await writeFile(
      join(vaultRoot, 'nodes', 'ideas', 'idea.temp.md'),
      ['---', 'id: temp', 'type: idea', 'title: Temp', 'status: seed', '---', '', 'Temp idea.'].join('\n'),
    );

    const { getVaultGitStatus } = await import('./vault-git.routes.js');
    const status = await getVaultGitStatus();

    expect(status.entries).toEqual([
      {
        nodeType: 'idea',
        path: 'nodes/ideas/idea.temp.md',
        status: 'untracked',
      },
    ]);
    expect(status.commitMessage).toBe('chore(vault): commit 1 file\n\n- 1 idea file');
  });

  it('rejects paths that escape the vault repo', async () => {
    const vaultRoot = await mkdtemp(join(tmpdir(), 'llaab-vault-git-'));
    process.env.LLAAB_VAULT = vaultRoot;
    vi.resetModules();

    const { toVaultGitPath } = await import('../../lib/vault-git.js');

    expect(() => toVaultGitPath('../outside.md')).toThrow('Invalid path.');
    expect(() => toVaultGitPath('/outside.md')).toThrow('Invalid path.');
    expect(toVaultGitPath('nodes/ideas/idea.temp.md')).toBe(join('nodes', 'ideas', 'idea.temp.md'));
  });
});
