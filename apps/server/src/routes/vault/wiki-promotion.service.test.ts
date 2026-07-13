import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WikiDraftNodeSchema } from '@llaab/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('promoteCreateWikiDraft', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'llaab-wiki-promotion-'));
    process.env.LLAAB_VAULT = join(tempDir, 'vault');
    process.env.LLAAB_KNOWLEDGE = join(tempDir, 'knowledge');
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.LLAAB_VAULT;
    delete process.env.LLAAB_KNOWLEDGE;
    await rm(tempDir, { force: true, recursive: true });
  });

  it('writes one promoted page and repairs a retry without a second revision', async () => {
    const core = await import('@llaab/core');
    const { promoteCreateWikiDraft } = await import('./wiki-promotion.service.js');
    const draft = WikiDraftNodeSchema.parse({
      id: 'context-management-draft',
      type: 'wiki-draft',
      title: 'Context management draft',
      tags: ['d:llm'],
      related: [],
      created_at: '2026-07-13T00:00:00Z',
      status: 'seed',
      body: '<!-- wiki-section:overview -->\\n\\n## Overview\\n\\nSource-backed draft.[^context-transcript]',
      topic_key: 'context-management',
      operation: 'create',
      draft_status: 'proposed',
      source_canonical_idea_ids: ['context-idea'],
      source_transcript_ids: ['context-transcript'],
      source_ids: ['context-source'],
      source_refs: [{ id: 'context-transcript', kind: 'transcript', verification: 'source-backed' }],
      sections: [
        {
          id: 'overview',
          heading: 'Overview',
          body: 'Source-backed draft.',
          source_ref_ids: ['context-transcript'],
        },
      ],
    });
    const created = await core.createNode({
      type: 'wiki-draft',
      title: draft.title,
      body: draft.body,
      tags: draft.tags,
      extra: Object.fromEntries(
        Object.entries(draft).filter(
          ([key]) =>
            !['id', 'type', 'title', 'body', 'tags', 'related', 'created_at', 'status'].includes(key),
        ),
      ),
    });
    const stored = await core.readNodeByType('wiki-draft', created.id);
    const [result, retry] = await Promise.all([
      promoteCreateWikiDraft(stored),
      promoteCreateWikiDraft({ ...stored, draft_status: 'proposed' }),
    ]);

    expect(result.page.revision).toBe(1);
    expect([result.recovered, retry.recovered].sort()).toEqual([false, true]);
    expect(await core.listKnowledgeWikis()).toHaveLength(1);
    expect((await core.readNodeByType('wiki-draft', stored.id)).draft_status).toBe('accepted');
  });

  it('rejects a conflicting duplicate topic and malformed citation refs', async () => {
    const core = await import('@llaab/core');
    const { promoteCreateWikiDraft } = await import('./wiki-promotion.service.js');
    await core.writeKnowledgeWiki({
      id: 'context-management',
      type: 'wiki',
      topic_key: 'context-management',
      title: 'Existing context page',
      aliases: [],
      summary: 'Existing',
      body: '<!-- wiki-section:overview -->\n\n## Overview\n\nExisting.[^existing-ref]',
      status: 'seed',
      tags: ['d:llm'],
      links: [],
      source_refs: [{ id: 'existing-ref', kind: 'transcript', verification: 'source-backed' }],
      source_canonical_idea_ids: [],
      source_transcript_ids: [],
      revision: 1,
      created_at: '2026-07-13T00:00:00Z',
      updated_at: '2026-07-13T00:00:00Z',
      verification_status: 'source-backed',
    });
    const duplicate = WikiDraftNodeSchema.parse({
      id: 'duplicate-draft',
      type: 'wiki-draft',
      title: 'Different generated page',
      tags: ['d:llm'],
      related: [],
      created_at: '2026-07-13T00:00:00Z',
      status: 'seed',
      body: '<!-- wiki-section:overview -->\n\n## Overview\n\nDifferent.[^different-ref]',
      topic_key: 'context-management',
      operation: 'create',
      source_refs: [{ id: 'different-ref', kind: 'transcript', verification: 'source-backed' }],
    });
    await expect(promoteCreateWikiDraft(duplicate)).rejects.toThrow('already represents this topic');

    const malformed = WikiDraftNodeSchema.parse({
      ...duplicate,
      id: 'malformed-draft',
      topic_key: 'malformed-page',
      body: '<!-- wiki-section:overview -->\n\n## Overview\n\nMissing ref.[^invented-ref]',
    });
    await expect(promoteCreateWikiDraft(malformed)).rejects.toThrow('unknown citation');
  });

  it('contains no Git command integration', async () => {
    const source = await readFile(new URL('./wiki-promotion.service.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/child_process|\bgit\s+(?:add|commit|push|status)\b/);
  });

  it('rejects a stale update draft without changing promoted knowledge', async () => {
    const core = await import('@llaab/core');
    const { promoteUpdateWikiDraft } = await import('./wiki-promotion.service.js');
    const page = {
      id: 'context-management',
      type: 'wiki' as const,
      topic_key: 'context-management',
      title: 'Context',
      aliases: [],
      summary: 'Current',
      body: '<!-- wiki-section:overview -->\\n\\n## Overview\\n\\nCurrent.[^context-transcript]',
      status: 'seed' as const,
      tags: ['d:llm'],
      links: [],
      source_refs: [
        { id: 'context-transcript', kind: 'transcript' as const, verification: 'source-backed' as const },
      ],
      source_canonical_idea_ids: [],
      source_transcript_ids: [],
      revision: 2,
      created_at: '2026-07-13T00:00:00Z',
      updated_at: '2026-07-13T00:00:00Z',
      verification_status: 'source-backed' as const,
    };
    await core.writeKnowledgeWiki(page);
    const draft = WikiDraftNodeSchema.parse({
      id: 'stale-update',
      type: 'wiki-draft',
      title: 'Context',
      tags: ['d:llm'],
      related: [],
      created_at: '2026-07-13T00:00:00Z',
      status: 'seed',
      body: '<!-- wiki-section:overview -->\\n\\n## Overview\\n\\nReplacement.[^context-transcript]',
      topic_key: 'context-management',
      target_wiki_id: 'context-management',
      operation: 'update',
      draft_status: 'proposed',
      source_canonical_idea_ids: [],
      source_transcript_ids: [],
      source_ids: [],
      source_refs: [{ id: 'context-transcript', kind: 'transcript', verification: 'source-backed' }],
      base_revision: 1,
      base_content_hash: 'a'.repeat(64),
      sections: [],
      patch: [],
    });

    await expect(promoteUpdateWikiDraft(draft)).rejects.toThrow('changed after this draft was compiled');
    expect((await core.readKnowledgeWiki('context-management')).body).toContain('Current.');
  });
});
