import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalCwd = process.cwd();

describe('node mutation layer', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'llaab-core-'));
    process.chdir(tempDir);
    vi.resetModules();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
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
      updatedAt: '2026-04-08T12:00:00.000Z',
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
    expect(reread.updatedAt).not.toBe(node.updatedAt);
  });

  it('preserves structural provenance fields on externally-derived nodes', async () => {
    const core = await import('@llaab/core');
    const { path } = await core.createNode({
      type: 'transcript',
      title: 'Transcript with provenance',
      body: 'Structured transcript body',
      tags: ['youtube'],
      extra: {
        sourceId: 'example-source',
        sourceUrl: 'https://example.com/video',
        sourceType: 'youtube',
      },
    });

    const reread = await core.readNode(path);

    expect(reread.type).toBe('transcript');

    if (reread.type !== 'transcript') return;

    expect(reread.sourceId).toBe('example-source');
  });
});
