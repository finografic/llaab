import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('knowledge wiki section review', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'llaab-wiki-section-review-'));
    process.env.LLAAB_KNOWLEDGE = join(root, 'knowledge');
    process.env.LLAAB_VAULT = join(root, 'vault');
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.LLAAB_KNOWLEDGE;
    delete process.env.LLAAB_VAULT;
    await rm(root, { force: true, recursive: true });
  });

  it('removes one section while retaining history and source validity', async () => {
    const core = await import('@llaab/core');
    await core.writeKnowledgeWiki({
      id: 'reviewable-wiki',
      type: 'wiki',
      topic_key: 'reviewable-wiki',
      title: 'Reviewable wiki',
      aliases: [],
      summary: 'Two sections',
      body: '<!-- wiki-section:first -->\n\n## First\n\nFirst.[^first-ref]\n\n<!-- wiki-section:second -->\n\n## Second\n\nSecond.[^second-ref]',
      status: 'seed',
      tags: ['reviewable'],
      links: [],
      source_refs: [
        { id: 'first-ref', kind: 'transcript', verification: 'source-backed' },
        { id: 'second-ref', kind: 'transcript', verification: 'source-backed' },
      ],
      source_canonical_idea_ids: [],
      source_transcript_ids: [],
      revision: 1,
      created_at: '2026-07-13T00:00:00Z',
      updated_at: '2026-07-13T00:00:00Z',
      verification_status: 'source-backed',
    });
    const { deleteKnowledgeWikiSection } = await import('./knowledge-wiki-review.service.js');
    const page = await deleteKnowledgeWikiSection('reviewable-wiki', 'first');

    expect(page.revision).toBe(2);
    expect(page.body).not.toContain('wiki-section:first');
    expect(page.body).toContain('wiki-section:second');
    await expect(deleteKnowledgeWikiSection('reviewable-wiki', 'second')).rejects.toThrow(
      'retain at least one',
    );
  });
});
