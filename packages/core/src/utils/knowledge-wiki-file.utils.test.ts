import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createdAt = '2026-07-13T00:00:00Z';

describe('knowledge wiki storage', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'llaab-knowledge-'));
    process.env.LLAAB_VAULT = join(tempDir, 'vault');
    process.env.LLAAB_KNOWLEDGE = join(tempDir, 'knowledge');
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.LLAAB_VAULT;
    delete process.env.LLAAB_KNOWLEDGE;
    await rm(tempDir, { force: true, recursive: true });
  });

  function createWikiPage() {
    return {
      id: 'context-management',
      type: 'wiki' as const,
      topic_key: 'context-management',
      title: 'Context Management',
      aliases: ['Agent context'],
      summary: 'A source-backed topic-level synthesis.',
      body: '<!-- wiki-section:overview -->\n\n## Overview\n\nUnicode proof: café.[^context-transcript]',
      status: 'seed' as const,
      tags: ['d:llm'],
      links: [
        { target_wiki_id: 'retrieval', relation: 'related-to' as const, note: 'Shared retrieval workflow.' },
      ],
      source_refs: [
        {
          id: 'context-transcript',
          kind: 'transcript' as const,
          node_id: 'context-transcript',
          verification: 'source-backed' as const,
        },
      ],
      source_canonical_idea_ids: ['context-idea'],
      source_transcript_ids: ['context-transcript'],
      revision: 1,
      created_at: createdAt,
      updated_at: createdAt,
      verification_status: 'source-backed' as const,
    };
  }

  it('round-trips structured wiki frontmatter without writing into the vault', async () => {
    const core = await import('@llaab/core');
    const page = createWikiPage();
    const { path } = await core.writeKnowledgeWiki(page);
    const reread = await core.readKnowledgeWiki(page.id);
    const listed = await core.listKnowledgeWikis();

    expect(path).toContain('/knowledge/wikis/context-management.md');
    expect(path).not.toContain('/vault/');
    expect(reread).toEqual(page);
    expect(listed).toEqual([page]);
    expect(core.hashKnowledgeWikiPage(page)).toBe(core.hashKnowledgeWikiPage(reread));

    const markdown = await readFile(path, 'utf-8');
    expect(markdown).toContain('<!-- wiki-section:overview -->');
    expect(markdown).toContain('source_refs: [{"id":"context-transcript"');
    expect(core.renderKnowledgeWikiCitation('context-transcript')).toBe('[^context-transcript]');
  });

  it('keeps vault nodes and promoted wiki files in their separate roots', async () => {
    const core = await import('@llaab/core');
    const idea = await core.createNode({
      type: 'idea',
      title: 'Separate roots',
      extra: { origin: 'manual' },
    });
    const wiki = await core.writeKnowledgeWiki(createWikiPage());

    expect(idea.path).toContain('/vault/nodes/ideas/');
    expect(wiki.path).toContain('/knowledge/wikis/');
  });

  it('serializes concurrent writes for the same wiki id', async () => {
    const core = await import('@llaab/core');
    const order: string[] = [];

    await Promise.all([
      core.withKnowledgeWikiLock('context-management', async () => {
        order.push('first-start');
        await new Promise((resolve) => setTimeout(resolve, 5));
        order.push('first-end');
      }),
      core.withKnowledgeWikiLock('context-management', async () => {
        order.push('second');
      }),
    ]);

    expect(order).toEqual(['first-start', 'first-end', 'second']);
  });

  it('rejects unsafe wiki identifiers before resolving a filesystem path', async () => {
    const core = await import('@llaab/core');

    expect(() => core.getKnowledgeWikiPath('../outside')).toThrow();
    expect(() => core.getKnowledgeWikiPath('/absolute')).toThrow();
  });

  it('rejects body citations that do not resolve to structured source references', async () => {
    const core = await import('@llaab/core');
    const page = createWikiPage();
    page.body = '<!-- wiki-section:overview -->\n\n## Overview\n\nUnsupported claim.[^missing-source]';

    await expect(core.writeKnowledgeWiki(page)).rejects.toThrow('citation does not resolve');
  });

  it('ignores documentation files in the promoted wiki directory', async () => {
    const core = await import('@llaab/core');
    await mkdir(join(process.env.LLAAB_KNOWLEDGE ?? '', 'wikis'), { recursive: true });
    await writeFile(
      join(process.env.LLAAB_KNOWLEDGE ?? '', 'wikis', 'README.md'),
      '# Knowledge wikis\n',
      'utf-8',
    );

    await expect(core.listKnowledgeWikis()).resolves.toEqual([]);
  });

  it('reads a known vault node directly by type', async () => {
    const core = await import('@llaab/core');
    const created = await core.createNode({
      type: 'wiki-draft',
      title: 'Direct draft read',
      extra: {
        topic_key: 'direct-draft-read',
        operation: 'create',
      },
    });
    const draft = await core.readNodeByType('wiki-draft', created.id);
    const drafts = await core.listNodes({ type: 'wiki-draft' });

    expect(draft.type).toBe('wiki-draft');
    expect(draft.topic_key).toBe('direct-draft-read');
    expect(drafts.map((entry) => entry.id)).toEqual([created.id]);
  });
});
