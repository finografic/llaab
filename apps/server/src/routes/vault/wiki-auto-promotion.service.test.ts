import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('autoPromoteWikiDrafts', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'llaab-wiki-auto-promotion-'));
    process.env.LLAAB_VAULT = join(root, 'vault');
    process.env.LLAAB_KNOWLEDGE = join(root, 'knowledge');
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.LLAAB_VAULT;
    delete process.env.LLAAB_KNOWLEDGE;
    await rm(root, { force: true, recursive: true });
  });

  it('does not invent a suffixed topic for needs-review drafts', async () => {
    const core = await import('@llaab/core');
    await core.writeKnowledgeWiki({
      id: 'context-management',
      type: 'wiki',
      topic_key: 'context-management',
      title: 'Existing context management',
      aliases: [],
      summary: 'Existing page',
      body: '<!-- wiki-section:existing -->\n\n## Existing\n\nExisting.[^existing-ref]',
      status: 'seed',
      tags: ['context-management'],
      links: [],
      source_refs: [{ id: 'existing-ref', kind: 'transcript', verification: 'source-backed' }],
      source_canonical_idea_ids: ['existing-idea'],
      source_transcript_ids: ['existing-transcript'],
      revision: 1,
      created_at: '2026-07-13T00:00:00Z',
      updated_at: '2026-07-13T00:00:00Z',
      verification_status: 'source-backed',
    });
    const created = await core.createNode({
      type: 'wiki-draft',
      title: 'New context page',
      body: '<!-- wiki-section:new-context -->\n\n## New context\n\nNew.[^new-ref]',
      tags: ['context-management', 'd:llm'],
      extra: {
        topic_key: 'context-management',
        operation: 'needs-review',
        source_canonical_idea_ids: ['new-idea'],
        source_transcript_ids: ['new-transcript'],
        source_refs: [{ id: 'new-ref', kind: 'transcript', verification: 'source-backed' }],
        quality_score: 84,
      },
    });

    const { autoPromoteWikiDrafts } = await import('./wiki-auto-promotion.service.js');
    const result = await autoPromoteWikiDrafts([created.id]);

    expect(result.pages).toHaveLength(0);
    expect(result.branches).toEqual([
      expect.objectContaining({
        draftId: created.id,
        outcome: 'skipped',
      }),
    ]);
    const wikis = await core.listKnowledgeWikis();
    expect(wikis).toHaveLength(1);
    expect(wikis.some((wiki) => /-\d+$/.test(wiki.id))).toBe(false);
    expect((await core.readNodeByType('wiki-draft', created.id)).draft_status).toBe('proposed');
    expect((await core.readNodeByType('wiki-draft', created.id)).topic_key).toBe('context-management');
  });

  it('auto-promotes a valid create draft', async () => {
    const core = await import('@llaab/core');
    const created = await core.createNode({
      type: 'wiki-draft',
      title: 'Isolation Boundaries',
      body: '<!-- wiki-section:overview -->\n\n## Overview\n\nIsolation limits blast radius.[^ref-1]',
      tags: ['isolation', 'd:agents'],
      extra: {
        topic_key: 'isolation-boundaries',
        operation: 'create',
        source_canonical_idea_ids: ['idea-isolation'],
        primary_canonical_idea_ids: ['idea-isolation'],
        source_transcript_ids: ['transcript-1'],
        source_refs: [
          { id: 'ref-1', kind: 'transcript', node_id: 'transcript-1', verification: 'source-backed' },
        ],
        quality_score: 88,
      },
    });

    const { autoPromoteWikiDrafts } = await import('./wiki-auto-promotion.service.js');
    const result = await autoPromoteWikiDrafts([created.id]);

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]?.id).toBe('isolation-boundaries');
    expect(result.branches[0]?.outcome).toBe('promoted-create');
    expect((await core.readNodeByType('wiki-draft', created.id)).draft_status).toBe('accepted');
  });
});
