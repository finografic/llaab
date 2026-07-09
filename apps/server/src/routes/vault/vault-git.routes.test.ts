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

  it('commits tracked vault files into the nested vault repo', async () => {
    const vaultRoot = await mkdtemp(join(tmpdir(), 'llaab-vault-git-'));
    process.env.LLAAB_VAULT = vaultRoot;
    vi.resetModules();

    const { commitVaultFile, runGit } = await import('../../lib/vault-git.js');
    expect((await runGit(['init'])).exitCode).toBe(0);
    expect((await runGit(['config', 'user.email', 'test@example.com'])).exitCode).toBe(0);
    expect((await runGit(['config', 'user.name', 'Vault Test'])).exitCode).toBe(0);

    await mkdir(join(vaultRoot, 'sources'), { recursive: true });
    await writeFile(
      join(vaultRoot, 'sources', 'source.temp.md'),
      ['---', 'id: temp', 'type: source', 'title: Temp', 'status: seed', '---', '', 'Temp source.'].join(
        '\n',
      ),
    );

    const result = await commitVaultFile(
      'sources/source.temp.md',
      'chore(vault-auto): refresh source metadata for Temp',
    );
    expect(result.sha).toMatch(/^[0-9a-f]{40}$/);

    const show = await runGit(['show', '--no-patch', '--format=%s', 'HEAD']);
    expect(show.stdout.trim()).toBe('chore(vault-auto): refresh source metadata for Temp');

    const status = await runGit(['status', '--porcelain=v1', '--untracked-files=all']);
    expect(status.stdout).toBe('');

    const committedFiles = await runGit(['show', '--name-only', '--format=', 'HEAD']);
    expect(committedFiles.stdout.trim()).toBe('sources/source.temp.md');
  });

  it('auto-commits enriched tracked sources with the vault-auto message', async () => {
    const vaultRoot = await mkdtemp(join(tmpdir(), 'llaab-vault-git-'));
    process.env.LLAAB_VAULT = vaultRoot;
    vi.resetModules();

    const { autoCommitTrackedSourceMetadata, runGit } = await import('../../lib/vault-git.js');
    expect((await runGit(['init'])).exitCode).toBe(0);
    expect((await runGit(['config', 'user.email', 'test@example.com'])).exitCode).toBe(0);
    expect((await runGit(['config', 'user.name', 'Vault Test'])).exitCode).toBe(0);

    await mkdir(join(vaultRoot, 'sources'), { recursive: true });
    const sourcePath = join(vaultRoot, 'sources', 'source.emergent-garden.md');
    await writeFile(
      sourcePath,
      [
        '---',
        'id: emergent-garden',
        'type: source',
        'title: Emergent Garden',
        'status: seed',
        '---',
        '',
      ].join('\n'),
    );
    expect((await runGit(['add', '--', 'sources/source.emergent-garden.md'])).exitCode).toBe(0);
    expect((await runGit(['commit', '-m', 'chore(vault): add source'])).exitCode).toBe(0);

    await writeFile(
      sourcePath,
      [
        '---',
        'id: emergent-garden',
        'type: source',
        'title: Emergent Garden',
        'status: seed',
        'updated_at: "2026-07-09T04:40:45Z"',
        'metadata_fetched_at: "2026-07-09T04:40:45Z"',
        'subscriber_count: 273000',
        'video_count: 72',
        '---',
        '',
      ].join('\n'),
    );

    const result = await autoCommitTrackedSourceMetadata('emergent-garden', 'Emergent Garden');
    expect(result.committed).toBe(true);
    expect(result.sha).toMatch(/^[0-9a-f]{40}$/);

    const show = await runGit(['show', '--no-patch', '--format=%s', 'HEAD']);
    expect(show.stdout.trim()).toBe('chore(vault-auto): refresh source metadata for Emergent Garden');

    const status = await runGit(['status', '--porcelain=v1', '--', 'sources/source.emergent-garden.md']);
    expect(status.stdout).toBe('');
  });

  it('skips auto-commit for untracked sources', async () => {
    const vaultRoot = await mkdtemp(join(tmpdir(), 'llaab-vault-git-'));
    process.env.LLAAB_VAULT = vaultRoot;
    vi.resetModules();

    const { autoCommitTrackedSourceMetadata, runGit } = await import('../../lib/vault-git.js');
    expect((await runGit(['init'])).exitCode).toBe(0);

    await mkdir(join(vaultRoot, 'sources'), { recursive: true });
    await writeFile(
      join(vaultRoot, 'sources', 'source.new-channel.md'),
      ['---', 'id: new-channel', 'type: source', 'title: New Channel', 'status: seed', '---', ''].join('\n'),
    );

    const result = await autoCommitTrackedSourceMetadata('new-channel', 'New Channel');
    expect(result).toEqual({ committed: false, skipped: true });

    const status = await runGit(['status', '--porcelain=v1', '--', 'sources/source.new-channel.md']);
    expect(status.stdout.trim()).toBe('?? sources/source.new-channel.md');
  });
});
