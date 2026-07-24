import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { KnowledgeWikiPage } from '@llaab/schemas';

function wiki(overrides: Partial<KnowledgeWikiPage> = {}): KnowledgeWikiPage {
  return {
    id: 'demote-target',
    type: 'wiki',
    topic_key: 'demote-target',
    title: 'Demote Target',
    aliases: [],
    summary: 'Summary',
    body: '<!-- wiki-section:overview -->\n\n## Overview\n\nBody.[^ref-1]',
    status: 'seed',
    tags: ['d:agents'],
    links: [],
    source_refs: [{ id: 'ref-1', kind: 'transcript', verification: 'source-backed' }],
    source_canonical_idea_ids: ['idea-a'],
    source_transcript_ids: ['transcript-a'],
    revision: 1,
    created_at: '2026-07-19T00:00:00Z',
    updated_at: '2026-07-19T00:00:00Z',
    verification_status: 'source-backed',
    ...overrides,
  };
}

describe('demoteKnowledgeWiki', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'llaab-wiki-demote-'));
    process.env.LLAAB_VAULT = join(root, 'vault');
    process.env.LLAAB_KNOWLEDGE = join(root, 'knowledge');
  });

  afterEach(async () => {
    delete process.env.LLAAB_VAULT;
    delete process.env.LLAAB_KNOWLEDGE;
    await rm(root, { force: true, recursive: true });
  });

  it('removes the promoted page while retaining draft lineage decisions', async () => {
    const core = await import('@llaab/core');
    await core.writeKnowledgeWiki(wiki());
    await core.writeKnowledgeWiki(
      wiki({
        id: 'linker',
        topic_key: 'linker',
        title: 'Linker',
        links: [
          {
            target_wiki_id: 'demote-target',
            relation: 'related-to',
            note: 'Linked for scrubbing.',
          },
        ],
      }),
    );
    const draft = await core.createNode({
      type: 'wiki-draft',
      id: 'demote-draft',
      title: 'Demote Target',
      body: '<!-- wiki-section:overview -->\n\n## Overview\n\nBody.[^ref-1]',
      tags: ['d:agents'],
      extra: {
        topic_key: 'demote-target',
        operation: 'create',
        draft_status: 'accepted',
        promoted_wiki_id: 'demote-target',
        source_canonical_idea_ids: ['idea-a'],
        source_transcript_ids: ['transcript-a'],
        source_refs: [{ id: 'ref-1', kind: 'transcript', verification: 'source-backed' }],
      },
    });

    const { demoteKnowledgeWiki } = await import('./knowledge-wiki-demote.service.js');
    const result = await demoteKnowledgeWiki('demote-target');

    expect(result.deletedWikiId).toBe('demote-target');
    expect(result.retainedDraftIds).toContain(draft.id);
    expect(result.scrubbedReferences.some((item) => item.wikiId === 'linker')).toBe(true);
    await expect(core.readKnowledgeWiki('demote-target')).rejects.toThrow();
    const retained = await core.readNodeByType('wiki-draft', draft.id);
    expect(retained.review_decisions.at(-1)?.decision).toBe('demoted');
  });
});
