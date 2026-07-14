import { mkdtemp, readFile, rm } from 'node:fs/promises';
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

  it('rebuilds directed and reverse edges from promoted wiki files', async () => {
    const core = await import('@llaab/core');
    const page = (
      id: string,
      links: Array<{ target_wiki_id: string; relation: 'related-to'; note: string }>,
    ) => ({
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
    await core.writeKnowledgeWiki(
      page('alpha', [
        { target_wiki_id: 'beta', relation: 'related-to', note: 'Shared source-backed mechanism.' },
      ]),
    );
    await core.writeKnowledgeWiki(page('beta', []));

    const graph = await core.buildKnowledgeWikiGraph();
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toEqual([{ source: 'alpha', target: 'beta', relation: 'related-to' }]);
    expect(graph.reverse_edges).toEqual([{ source: 'beta', target: 'alpha', relation: 'related-to' }]);
    expect(graph.diagnostics).toEqual([]);
  });

  it('diagnoses invalid links without treating diagnostics as authoritative edges', async () => {
    const core = await import('@llaab/core');
    const graph = core.buildKnowledgeWikiGraphFromPages([
      {
        id: 'alpha',
        type: 'wiki',
        topic_key: 'alpha',
        title: 'Alpha',
        aliases: [],
        summary: 'Alpha',
        body: '',
        status: 'seed',
        tags: ['d:test'],
        links: [
          { target_wiki_id: 'alpha', relation: 'related-to', note: 'Self reference.' },
          { target_wiki_id: 'missing', relation: 'supports', note: 'Missing target.' },
          { target_wiki_id: 'beta', relation: 'related-to', note: 'd:test' },
          { target_wiki_id: 'beta', relation: 'related-to', note: 'Duplicate relation.' },
        ],
        source_refs: [],
        source_canonical_idea_ids: [],
        source_transcript_ids: [],
        revision: 1,
        created_at: '2026-07-13T00:00:00Z',
        updated_at: '2026-07-13T00:00:00Z',
        verification_status: 'source-backed',
      },
      {
        id: 'beta',
        type: 'wiki',
        topic_key: 'beta',
        title: 'Beta',
        aliases: [],
        summary: 'Beta',
        body: '',
        status: 'seed',
        tags: ['d:test'],
        links: [],
        source_refs: [],
        source_canonical_idea_ids: [],
        source_transcript_ids: [],
        revision: 1,
        created_at: '2026-07-13T00:00:00Z',
        updated_at: '2026-07-13T00:00:00Z',
        verification_status: 'source-backed',
      },
    ]);

    expect(graph.edges).toEqual([{ source: 'alpha', target: 'beta', relation: 'related-to' }]);
    expect(graph.diagnostics).toEqual([
      'Broken link: alpha -> missing',
      'Duplicate link: alpha:related-to:beta',
      'Link evidence cannot be only a domain tag: alpha -> beta',
      'Self link: alpha',
    ]);
  });

  it('exports a reproducible derived graph that rebuilds after export deletion', async () => {
    const core = await import('@llaab/core');
    const page = (
      id: string,
      links: Array<{ target_wiki_id: string; relation: 'supports'; note: string }>,
    ) => ({
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
    await core.writeKnowledgeWiki(
      page('beta', [{ target_wiki_id: 'alpha', relation: 'supports', note: 'Beta expands alpha.' }]),
    );
    await core.writeKnowledgeWiki(page('alpha', []));

    const first = await core.exportKnowledgeWikiGraph();
    const firstContent = await readFile(first.path, 'utf-8');
    await rm(first.path, { force: true });
    const second = await core.exportKnowledgeWikiGraph();

    expect(second.graph).toEqual(first.graph);
    expect(await readFile(second.path, 'utf-8')).toBe(firstContent);
    expect(first.path).toContain('/knowledge-graphs/wiki-graph.json');
  });

  it('filters graph nodes and edges deterministically', async () => {
    const core = await import('@llaab/core');
    const page = (
      id: string,
      tags: string[],
      links: Array<{ target_wiki_id: string; relation: 'extends'; note: string }>,
    ) => ({
      id,
      type: 'wiki' as const,
      topic_key: id,
      title: id,
      aliases: [],
      summary: id,
      body: `<!-- wiki-section:overview -->\n\n## Overview\n\nEvidence.[^${id}-source]`,
      status: 'seed' as const,
      tags,
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
    await core.writeKnowledgeWiki(page('alpha', ['d:included'], []));
    await core.writeKnowledgeWiki(
      page(
        'beta',
        ['d:included'],
        [{ target_wiki_id: 'alpha', relation: 'extends', note: 'Beta extends alpha.' }],
      ),
    );
    await core.writeKnowledgeWiki(
      page(
        'gamma',
        ['d:excluded'],
        [{ target_wiki_id: 'alpha', relation: 'extends', note: 'Gamma extends alpha.' }],
      ),
    );

    const graph = await core.buildKnowledgeWikiGraph({ tag: 'd:included' });

    expect(graph.nodes.map((node) => node.id)).toEqual(['alpha', 'beta']);
    expect(graph.edges).toEqual([{ source: 'beta', target: 'alpha', relation: 'extends' }]);
    expect(graph.diagnostics).toEqual([]);
  });
});
