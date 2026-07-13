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

  it('subtracts canonical ideas already represented by promoted knowledge', async () => {
    const core = await import('@llaab/core');
    const { discoverWikiCandidates } = await import('./discover-wiki-candidates.js');
    const transcripts = await Promise.all(
      ['first', 'second', 'third'].map((title) =>
        core.createNode({ type: 'transcript', title, extra: { source_type: 'other' } }),
      ),
    );
    const ideas = await Promise.all(
      transcripts.map((transcript, index) =>
        core.createNode({
          type: 'canonical-idea',
          title: `Context discovery ${index}`,
          tags: ['d:context'],
          extra: { transcript_id: transcript.id, source_candidate_idea_ids: [] },
        }),
      ),
    );
    await core.writeKnowledgeWiki({
      id: 'context',
      type: 'wiki',
      topic_key: 'context',
      title: 'Context',
      aliases: [],
      summary: 'Already represented.',
      body: '<!-- wiki-section:overview -->\n\n## Overview\n\nKnown.[^source-ref]',
      status: 'seed',
      tags: ['d:context'],
      links: [],
      source_refs: [{ id: 'source-ref', kind: 'transcript', verification: 'source-backed' }],
      source_canonical_idea_ids: ideas.map((idea) => idea.id),
      source_transcript_ids: transcripts.map((transcript) => transcript.id),
      revision: 1,
      created_at: '2026-07-13T00:00:00Z',
      updated_at: '2026-07-13T00:00:00Z',
      verification_status: 'source-backed',
    });

    const result = await discoverWikiCandidates();

    expect(result.result.candidateCount).toBe(0);
    expect(await core.listNodes({ type: 'wiki-candidate' })).toHaveLength(0);
  });
});
