import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeWikiPage } from '@llaab/schemas';

const createdAt = '2026-07-13T00:00:00Z';

function wiki(overrides: Partial<KnowledgeWikiPage>): KnowledgeWikiPage {
  return {
    id: 'source-wiki',
    type: 'wiki',
    topic_key: 'source-wiki',
    title: 'Source Wiki',
    aliases: [],
    summary: 'A source-backed wiki.',
    body: '<!-- wiki-section:overview -->\n\n## Overview\n\nSourced.[^source-ref]',
    status: 'seed',
    tags: ['d:llm', 'topic'],
    links: [],
    source_refs: [
      {
        id: 'source-ref',
        kind: 'transcript',
        node_id: 'source-ref',
        verification: 'source-backed',
      },
    ],
    source_canonical_idea_ids: ['source-idea'],
    source_transcript_ids: ['source-transcript'],
    revision: 1,
    created_at: createdAt,
    updated_at: createdAt,
    verification_status: 'source-backed',
    ...overrides,
  };
}

describe('deleteKnowledgeWikiAndReferences', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'llaab-knowledge-delete-'));
    process.env.LLAAB_VAULT = join(tempDir, 'vault');
    process.env.LLAAB_KNOWLEDGE = join(tempDir, 'knowledge');
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.LLAAB_VAULT;
    delete process.env.LLAAB_KNOWLEDGE;
    await rm(tempDir, { force: true, recursive: true });
  });

  it('deletes the promoted wiki and scrubs inbound links from remaining wikis', async () => {
    const core = await import('@llaab/core');
    const { deleteKnowledgeWikiAndReferences } = await import('./knowledge-wiki-delete.service.js');

    await core.writeKnowledgeWiki(wiki({ id: 'target-wiki', topic_key: 'target-wiki', title: 'Target' }));
    await core.writeKnowledgeWiki(
      wiki({
        id: 'source-wiki',
        topic_key: 'source-wiki',
        title: 'Source',
        links: [{ target_wiki_id: 'target-wiki', relation: 'related-to', note: 'Explicit relation.' }],
      }),
    );

    const result = await deleteKnowledgeWikiAndReferences('target-wiki');
    const remaining = await core.readKnowledgeWiki('source-wiki');

    expect(result.deletedWikiId).toBe('target-wiki');
    expect(result.scrubbedReferences).toEqual([{ wikiId: 'source-wiki', removedLinks: 1, revision: 2 }]);
    await expect(core.readKnowledgeWiki('target-wiki')).rejects.toThrow();
    expect(remaining.links).toEqual([]);
    expect(remaining.revision).toBe(2);
  });
});
