import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LabNode, NodeStatus, NodeType } from '@llaab/schemas';

const baseDate = '2026-07-26T00:00:00.000Z';

describe('vault search', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'llaab-search-'));
    process.env.LLAAB_VAULT = join(tempDir, 'vault');
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.LLAAB_VAULT;
    await rm(tempDir, { force: true, recursive: true });
  });

  it('ranks title matches above tag matches above body matches', async () => {
    const { rankVaultSearchNodes } = await import('./search-vault-nodes.utils.js');
    const results = rankVaultSearchNodes(
      [
        node({ body: 'retrieval only appears deep in the body', id: 'body-hit', title: 'Body Hit' }),
        node({ id: 'tag-hit', tags: ['d:retrieval'], title: 'Tag Hit' }),
        node({ id: 'title-hit', title: 'Retrieval Contract' }),
      ],
      { query: 'retrieval' },
    );

    expect(results.map((result) => result.node_id)).toEqual(['title-hit', 'tag-hit', 'body-hit']);
    expect(results[0]?.matches).toEqual([{ field: 'title', value: 'Retrieval Contract' }]);
    expect(results[2]?.snippet).toContain('retrieval only appears');
  });

  it('uses recency, title, and id as deterministic tie-breakers', async () => {
    const { rankVaultSearchNodes } = await import('./search-vault-nodes.utils.js');
    const results = rankVaultSearchNodes(
      [
        node({
          created_at: '2026-07-24T00:00:00.000Z',
          id: 'older-z',
          title: 'Zeta retrieval',
        }),
        node({
          created_at: '2026-07-25T00:00:00.000Z',
          id: 'newer-z',
          title: 'Zeta retrieval',
        }),
        node({
          created_at: '2026-07-25T00:00:00.000Z',
          id: 'newer-a',
          title: 'Alpha retrieval',
        }),
      ],
      { query: 'retrieval' },
    );

    expect(results.map((result) => result.node_id)).toEqual(['newer-a', 'newer-z', 'older-z']);
  });

  it('filters by type, status, tags, and limit', async () => {
    const { rankVaultSearchNodes } = await import('./search-vault-nodes.utils.js');
    const results = rankVaultSearchNodes(
      [
        node({ id: 'idea-match', tags: ['d:llm'], title: 'Retrieval idea', type: 'idea' }),
        node({ id: 'resource-match', tags: ['d:llm'], title: 'Retrieval resource', type: 'resource' }),
        node({ id: 'archived-match', status: 'archived', tags: ['d:llm'], title: 'Retrieval archived' }),
        node({ id: 'other-tag', tags: ['d:ui'], title: 'Retrieval ui' }),
      ],
      { limit: 1, query: 'retrieval', status: 'seed', tags: ['d:llm'], type: 'idea' },
    );

    expect(results.map((result) => result.node_id)).toEqual(['idea-match']);
  });

  it('returns no results for empty queries', async () => {
    const { rankVaultSearchNodes } = await import('./search-vault-nodes.utils.js');

    expect(rankVaultSearchNodes([node({ title: 'Anything' })], { query: '   ' })).toEqual([]);
  });

  it('reads vault nodes through the same contract', async () => {
    const core = await import('@llaab/core');
    await core.createNode({
      body: 'Context assembly should cite direct evidence instead of stuffing prompts.',
      id: 'context-assembly',
      tags: ['d:retrieval'],
      title: 'Context Assembly',
      type: 'idea',
    });

    const results = await core.searchVaultNodes({ query: 'direct evidence' });

    expect(results).toHaveLength(1);
    expect(results[0]?.node_id).toBe('context-assembly');
    expect(results[0]?.path).toContain('/vault/nodes/ideas/idea.context-assembly.md');
    expect(results[0]?.provenance).toMatchObject({
      node_id: 'context-assembly',
      node_type: 'idea',
    });
  });
});

function node(input: Partial<LabNode> & { id?: string; title: string }): LabNode {
  const { body, created_at, id, related, status, tags, title, type, ...extra } = input;
  return {
    body: body ?? '',
    created_at: created_at ?? baseDate,
    id: id ?? title.toLowerCase().replace(/\s+/g, '-'),
    related: related ?? [],
    status: (status ?? 'seed') as NodeStatus,
    tags: tags ?? [],
    title,
    type: (type ?? 'idea') as NodeType,
    ...extra,
  } as LabNode;
}
