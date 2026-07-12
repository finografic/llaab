import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('buildKnowledgeWikiGraph', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'llaab-wiki-graph-'));
    process.env.LLAAB_KNOWLEDGE = root;
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.LLAAB_KNOWLEDGE;
    await rm(root, { force: true, recursive: true });
  });

  it('rebuilds directed edges from promoted wiki files', async () => {
    const core = await import('@llaab/core');
    const page = (id: string, links: Array<{ target_wiki_id: string; relation: 'related-to' }>) => ({
      id,
      type: 'wiki' as const,
      topic_key: id,
      title: id,
      aliases: [],
      summary: id,
      body: `<!-- wiki-section:overview -->\n\n## Overview\n\nEvidence.[^${id}-source]`,
      status: 'seed' as const,
      tags: ['d:test'],
      links,
      source_refs: [
        { id: `${id}-source`, kind: 'transcript' as const, verification: 'source-backed' as const },
      ],
      source_canonical_idea_ids: [],
      source_transcript_ids: [],
      revision: 1,
      created_at: '2026-07-13T00:00:00Z',
      updated_at: '2026-07-13T00:00:00Z',
      verification_status: 'source-backed' as const,
    });
    await core.writeKnowledgeWiki(page('alpha', [{ target_wiki_id: 'beta', relation: 'related-to' }]));
    await core.writeKnowledgeWiki(page('beta', []));

    const graph = await core.buildKnowledgeWikiGraph();
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toEqual([{ source: 'alpha', target: 'beta', relation: 'related-to' }]);
    expect(graph.diagnostics).toEqual([]);
  });
});
