import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('discoverWikiCandidates', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'llaab-wiki-discovery-'));
    process.env.LLAAB_VAULT = join(root, 'vault');
    process.env.LLAAB_KNOWLEDGE = join(root, 'knowledge');
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.LLAAB_VAULT;
    delete process.env.LLAAB_KNOWLEDGE;
    await rm(root, { force: true, recursive: true });
  });

  it('requires diverse evidence and is idempotent across runs', async () => {
    const core = await import('@llaab/core');
    const { discoverWikiCandidates } = await import('./discover-wiki-candidates.js');
    const first = await core.createNode({
      type: 'transcript',
      title: 'First',
      extra: { source_type: 'youtube', source_id: 'source-a', source_url: 'https://example.com/first' },
    });
    const second = await core.createNode({
      type: 'transcript',
      title: 'Second',
      extra: { source_type: 'youtube', source_id: 'source-b', source_url: 'https://example.com/second' },
    });
    for (const [index, transcriptId] of [first.id, second.id, second.id].entries()) {
      await core.createNode({
        type: 'canonical-idea',
        title: `Context idea ${index}`,
        tags: ['d:context'],
        extra: { transcript_id: transcriptId, source_candidate_idea_ids: [`candidate-${index}`] },
      });
    }

    const firstRun = await discoverWikiCandidates();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 1_000));
    const secondRun = await discoverWikiCandidates();
    vi.useRealTimers();
    const candidates = await core.listNodes({ type: 'wiki-candidate' });

    expect(firstRun.result.candidateCount).toBe(1);
    expect(secondRun.result.candidateCount).toBe(0);
    expect(candidates).toHaveLength(1);
  });
});
