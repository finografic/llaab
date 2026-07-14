import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { routeLlm } = vi.hoisted(() => ({ routeLlm: vi.fn() }));
vi.mock('@llaab/llm', () => ({ routeLlm }));

describe('discoverWikiCandidates', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'llaab-wiki-discovery-'));
    process.env.LLAAB_VAULT = join(root, 'vault');
    process.env.LLAAB_KNOWLEDGE = join(root, 'knowledge');
    routeLlm.mockReset();
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
    expect((await core.readNodeByType('run', firstRun.record.runNodeId)).produced_node_ids).toEqual([
      'context-candidate',
    ]);
    expect(secondRun.result.candidateCount).toBe(0);
    expect(candidates).toHaveLength(1);
  });

  it('honors explicit discovery thresholds for bounded one-shot runs', async () => {
    const core = await import('@llaab/core');
    const { discoverWikiCandidates } = await import('./discover-wiki-candidates.js');
    const first = await core.createNode({
      type: 'transcript',
      title: 'First',
      extra: { source_type: 'other' },
    });
    const second = await core.createNode({
      type: 'transcript',
      title: 'Second',
      extra: { source_type: 'other' },
    });
    for (const [index, transcriptId] of [first.id, second.id].entries()) {
      await core.createNode({
        type: 'canonical-idea',
        title: `Threshold idea ${index}`,
        tags: ['d:threshold'],
        extra: { transcript_id: transcriptId, source_candidate_idea_ids: [`threshold-${index}`] },
      });
    }

    const defaultResult = await discoverWikiCandidates();
    const configuredResult = await discoverWikiCandidates({ minCanonicalIdeas: 2, minTranscripts: 2 });

    expect(defaultResult.result.candidateCount).toBe(0);
    expect(configuredResult.result.candidateCount).toBe(1);
    expect((await core.listNodes({ type: 'wiki-candidate' }))[0]?.id).toBe('threshold-candidate');
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

  it('persists validated optional model-review provenance without accepting invented ids', async () => {
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
          title: `Context review ${index}`,
          tags: ['d:context'],
          extra: { transcript_id: transcript.id, source_candidate_idea_ids: [] },
        }),
      ),
    );
    routeLlm.mockImplementation(async (_task, prompt) => {
      const input = JSON.parse(prompt) as { canonical_ideas: Array<{ id: string }> };
      return {
        text: JSON.stringify({
          title: 'Reviewed context',
          topic_key: 'context',
          recommendation: 'create',
          canonical_idea_ids: input.canonical_ideas.map((idea) => idea.id),
          existing_wiki_ids: [],
          warnings: ['Model review accepted deterministic cluster coherence.'],
        }),
        model: 'test-model',
        provider: 'ollama',
        durationMs: 5,
      };
    });

    const result = await discoverWikiCandidates({ modelReview: true });
    const candidate = (await core.listNodes({ type: 'wiki-candidate' }))[0];

    expect(result.record.status).toBe('completed');
    expect(routeLlm).toHaveBeenCalledWith('wiki-discover', expect.any(String), expect.any(Object));
    expect(candidate).toMatchObject({
      title: 'Reviewed context',
      llm_model: 'test-model',
      llm_provider: 'ollama',
      source_canonical_idea_ids: ideas.map((idea) => idea.id),
    });
  });
});
