import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('node mutation layer', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'llaab-core-'));
    process.env.LLAAB_VAULT = join(tempDir, 'vault');
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.LLAAB_VAULT;
    await rm(tempDir, { force: true, recursive: true });
  });

  it('writeNode persists an updated node to the same file', async () => {
    const core = await import('@llaab/core');
    const { node, path } = await core.createNode({
      type: 'idea',
      title: 'Mutation layer test',
      body: 'Before write',
      extra: { origin: 'manual' },
    });

    const maybeWriteNode = (core as Record<string, unknown>).writeNode;

    expect(typeof maybeWriteNode).toBe('function');

    if (typeof maybeWriteNode !== 'function') return;

    const nextNode = {
      ...node,
      body: 'After write',
      tags: [...node.tags, 'updated'],
      updated_at: '2026-04-08T12:00:00.000Z',
    };

    await maybeWriteNode(nextNode);

    const reread = await core.readNode(path);

    expect(reread.id).toBe(node.id);
    expect(reread.type).toBe(node.type);
    expect(reread.body).toBe('After write');
    expect(reread.tags).toContain('updated');
  });

  it('updateNode preserves id and type while applying an updater', async () => {
    const core = await import('@llaab/core');
    const { node, path } = await core.createNode({
      type: 'idea',
      title: 'Updater test',
      body: 'Seed body',
      extra: { origin: 'manual' },
    });

    const maybeUpdateNode = (core as Record<string, unknown>).updateNode;

    expect(typeof maybeUpdateNode).toBe('function');

    if (typeof maybeUpdateNode !== 'function') return;

    await maybeUpdateNode(path, (current: typeof node) => ({
      ...current,
      body: 'Updated body',
      tags: [...current.tags, 'refined'],
      type: current.type,
      id: current.id,
    }));

    const reread = await core.readNode(path);

    expect(reread.id).toBe(node.id);
    expect(reread.type).toBe(node.type);
    expect(reread.body).toBe('Updated body');
    expect(reread.tags).toContain('refined');
    expect(reread.updated_at).toBeDefined();
    expect(node.updated_at).toBeDefined();
    expect(Date.parse(reread.updated_at!)).toBeGreaterThanOrEqual(Date.parse(node.updated_at!));
  });

  it('preserves structural provenance fields on externally-derived nodes', async () => {
    const core = await import('@llaab/core');
    const { path } = await core.createNode({
      type: 'transcript',
      title: 'Transcript with provenance',
      body: 'Structured transcript body',
      tags: ['youtube'],
      extra: {
        source_id: 'example-source',
        source_url: 'https://example.com/video',
        source_type: 'youtube',
      },
    });

    const reread = await core.readNode(path);

    expect(reread.type).toBe('transcript');

    if (reread.type !== 'transcript') return;

    expect(reread.source_id).toBe('example-source');
  });
});
