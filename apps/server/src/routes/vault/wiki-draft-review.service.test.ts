import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WikiDraftNodeSchema } from '@llaab/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('wiki draft review service', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'llaab-wiki-review-'));
    process.env.LLAAB_VAULT = join(root, 'vault');
    process.env.LLAAB_KNOWLEDGE = join(root, 'knowledge');
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.LLAAB_VAULT;
    delete process.env.LLAAB_KNOWLEDGE;
    await rm(root, { force: true, recursive: true });
  });

  it('persists an explicit rejection decision', async () => {
    const core = await import('@llaab/core');
    const { rejectWikiDraftReview } = await import('./wiki-draft-review.service.js');
    const created = await core.createNode({
      type: 'wiki-draft',
      title: 'Reject me',
      body: '',
      extra: { topic_key: 'reject-me', operation: 'create' },
    });
    const draft = await core.readNodeByType('wiki-draft', created.id);
    const rejected = await rejectWikiDraftReview(draft);

    expect(rejected.draft_status).toBe('rejected');
    expect(rejected.review_decisions).toEqual([
      expect.objectContaining({ decision: 'rejected', reason: expect.stringContaining('explicit') }),
    ]);
    await expect(rejectWikiDraftReview(rejected)).rejects.toThrow('Only proposed');
  });

  it('revalidates edited citations and preserves unpatched promoted sections', async () => {
    const core = await import('@llaab/core');
    const { applyWikiDraftEdit } = await import('./wiki-draft-review.service.js');
    const promoted = {
      id: 'edit-target',
      type: 'wiki' as const,
      topic_key: 'edit-target',
      title: 'Edit target',
      aliases: [],
      summary: 'Existing page',
      body: '<!-- wiki-section:overview -->\n\n## Overview\n\nOld.[^source-ref]\n\n<!-- wiki-section:manual -->\n\n## Manual\n\nHuman text.[^source-ref]',
      status: 'seed' as const,
      tags: [],
      links: [],
      source_refs: [
        { id: 'source-ref', kind: 'transcript' as const, verification: 'source-backed' as const },
      ],
      source_canonical_idea_ids: ['canonical-idea'],
      source_transcript_ids: ['transcript-id'],
      revision: 1,
      created_at: '2026-07-13T00:00:00Z',
      updated_at: '2026-07-13T00:00:00Z',
      verification_status: 'source-backed' as const,
    };
    await core.writeKnowledgeWiki(promoted);
    const draft = WikiDraftNodeSchema.parse({
      id: 'edit-draft',
      type: 'wiki-draft',
      title: 'Edit target',
      body: '<!-- wiki-section:overview -->\n\n## Overview\n\nProposed.[^source-ref]',
      tags: [],
      related: [],
      created_at: '2026-07-13T00:00:00Z',
      status: 'seed',
      topic_key: 'edit-target',
      target_wiki_id: 'edit-target',
      operation: 'update',
      source_refs: [{ id: 'source-ref', kind: 'transcript', verification: 'source-backed' }],
      sections: [
        {
          id: 'overview',
          heading: 'Overview',
          body: 'Proposed.',
          source_ref_ids: ['source-ref'],
          source_canonical_idea_ids: ['canonical-idea'],
        },
      ],
    });
    const created = await core.createNode({
      type: 'wiki-draft',
      id: draft.id,
      title: draft.title,
      body: draft.body,
      extra: Object.fromEntries(
        Object.entries(draft).filter(
          ([key]) =>
            !['id', 'type', 'title', 'body', 'tags', 'related', 'created_at', 'status'].includes(key),
        ),
      ),
    });
    const stored = await core.readNodeByType('wiki-draft', created.id);

    await expect(
      applyWikiDraftEdit(stored, {
        sections: [{ ...stored.sections[0]!, source_ref_ids: ['invented-ref'] }],
      }),
    ).rejects.toThrow('unknown source ref');
    const edited = await applyWikiDraftEdit(stored, {
      sections: [{ ...stored.sections[0]!, body: 'Reviewer edit.' }],
    });

    expect(edited.resulting_body).toContain('Reviewer edit.');
    expect(edited.resulting_body).toContain('Human text.');
    expect(edited.unchanged_section_ids).toContain('manual');
  });
});
