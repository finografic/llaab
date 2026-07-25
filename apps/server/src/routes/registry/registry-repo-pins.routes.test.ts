import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RepoMetaResponse } from '@llaab/schemas';

const { fetchRepoMeta } = vi.hoisted(() => ({
  fetchRepoMeta: vi.fn(),
}));

vi.mock('./registry-github.routes.js', () => ({
  fetchRepoMeta,
}));

const META: RepoMetaResponse = {
  fullName: 'finografic/LLAAB',
  name: 'LLAAB',
  owner: 'finografic',
  description: 'Local learning agent app base.',
  topics: ['agents'],
  language: 'TypeScript',
  stars: 42,
  forks: 3,
  openIssues: 2,
  license: 'MIT',
  updatedAt: '2026-07-25T00:00:00Z',
  pushedAt: '2026-07-25T01:00:00Z',
  htmlUrl: 'https://github.com/finografic/LLAAB',
  homepage: null,
  defaultBranch: 'master',
};

describe('pinRepository', () => {
  let root: string;
  let pinsPath: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'llaab-repo-pins-'));
    pinsPath = join(root, 'pinned-repositories.json');
    process.env.LLAAB_REPO_PINS_PATH = pinsPath;
    process.env.LLAAB_VAULT = join(root, 'vault');
    fetchRepoMeta.mockReset();
    fetchRepoMeta.mockResolvedValue(META);
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.LLAAB_REPO_PINS_PATH;
    delete process.env.LLAAB_VAULT;
    await rm(root, { force: true, recursive: true });
  });

  it('merges inbox provenance on idempotent repository pins', async () => {
    const { pinRepository } = await import('./registry-repo-pins.routes.js');
    const firstProvenance = {
      routeKind: 'github_repo',
      source: { platform: 'telegram', chat_id: 'chat-1', message_id: 'message-1' },
      payload: {
        owner: 'finografic',
        repo: 'LLAAB',
        url: 'https://github.com/finografic/LLAAB',
      },
      capturedAt: '2026-07-25T01:00:00Z',
    };
    const secondProvenance = {
      routeKind: 'github_repo',
      source: { platform: 'telegram', chat_id: 'chat-1', message_id: 'message-2' },
      payload: {
        owner: 'finografic',
        repo: 'LLAAB',
        url: 'https://github.com/finografic/LLAAB',
      },
      capturedAt: '2026-07-25T02:00:00Z',
    };

    const first = await pinRepository.handler(
      routeContext({ fullName: 'finografic/LLAAB', provenance: firstProvenance }),
    );
    const second = await pinRepository.handler(
      routeContext({ fullName: 'finografic/LLAAB', provenance: secondProvenance }),
    );
    const repeat = await pinRepository.handler(
      routeContext({ fullName: 'finografic/LLAAB', provenance: secondProvenance }),
    );

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(repeat.status).toBe(409);
    expect(fetchRepoMeta).toHaveBeenCalledTimes(1);

    const pins = JSON.parse(await readFile(pinsPath, 'utf-8')) as Array<{ provenance?: unknown[] }>;
    expect(pins[0]?.provenance).toEqual([firstProvenance, secondProvenance]);

    const resourcePath = join(
      root,
      'vault',
      'nodes',
      'resources',
      'resource.registry-repo-finografic-llaab.md',
    );
    await expect(readFile(resourcePath, 'utf-8')).resolves.toContain('## Inbox Provenance');
    await expect(readFile(resourcePath, 'utf-8')).resolves.toContain('message message-2');
  });
});

function routeContext(body: unknown) {
  return {
    req: {
      valid: () => body,
    },
    json: (payload: unknown, status?: number) =>
      new Response(JSON.stringify(payload), { status: status ?? 200 }),
  } as never;
}
