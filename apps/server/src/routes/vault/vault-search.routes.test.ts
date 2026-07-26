import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('vault search route', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'llaab-vault-search-route-'));
    process.env.LLAAB_VAULT = join(root, 'vault');
    delete process.env.LLAAB_API_KEY;
    delete process.env.LLAAB_PASSWORD;
    delete process.env.VAULT_PASSWORD;
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.LLAAB_VAULT;
    await rm(root, { force: true, recursive: true });
  });

  it('returns ranked vault search results with provenance metadata', async () => {
    const core = await import('@llaab/core');
    await core.createNode({
      body: 'Retrieval evidence should include match snippets and source paths.',
      id: 'route-search-fixture',
      tags: ['d:retrieval'],
      title: 'Route Search Fixture',
      type: 'idea',
    });

    const { app } = await import('../../app.js');
    const response = await app.request('/api/vault/search?query=evidence&limit=5');
    const body = (await response.json()) as {
      results: Array<{
        node_id: string;
        path: string;
        provenance: { node_id: string; path: string };
        snippet: string;
      }>;
    };

    expect(response.status).toBe(200);
    expect(body.results).toHaveLength(1);
    expect(body.results[0]?.node_id).toBe('route-search-fixture');
    expect(body.results[0]?.snippet).toContain('Retrieval evidence');
    expect(body.results[0]?.path).toContain('/vault/nodes/ideas/idea.route-search-fixture.md');
    expect(body.results[0]?.provenance.path).toBe(body.results[0]?.path);
  });

  it('validates that query is required', async () => {
    const { app } = await import('../../app.js');
    const response = await app.request('/api/vault/search');

    expect(response.status).toBe(400);
  });
});
