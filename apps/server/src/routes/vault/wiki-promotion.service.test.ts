import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { WikiDraftNodeSchema } from '@llaab/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const execFileAsync = promisify(execFile);

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

  it('leaves parent knowledge and nested vault changes visible for explicit review', async () => {
    await mkdir(process.env.LLAAB_VAULT!, { recursive: true });
    await execFileAsync('git', ['init'], { cwd: tempDir });
    await execFileAsync('git', ['init'], { cwd: process.env.LLAAB_VAULT! });
    const core = await import('@llaab/core');
    const { promoteCreateWikiDraft } = await import('./wiki-promotion.service.js');
    const draft = WikiDraftNodeSchema.parse({
      id: 'repo-boundary-draft',
      type: 'wiki-draft',
      title: 'Repo boundary draft',
      tags: ['d:llm'],
      related: [],
      created_at: '2026-07-13T00:00:00Z',
      status: 'seed',
      body: '<!-- wiki-section:overview -->\\n\\n## Overview\\n\\nBoundary.[^boundary-ref]',
      topic_key: 'repo-boundary',
      operation: 'create',
      draft_status: 'proposed',
      source_refs: [{ id: 'boundary-ref', kind: 'transcript', verification: 'source-backed' }],
    });
    const created = await core.createNode({
      type: 'wiki-draft',
      id: draft.id,
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

    const beforeParent = await execFileAsync('git', ['status', '--short', '--untracked-files=all'], {
      cwd: tempDir,
    });
    const beforeVault = await execFileAsync('git', ['status', '--short', '--untracked-files=all'], {
      cwd: process.env.LLAAB_VAULT!,
    });

    await promoteCreateWikiDraft(await core.readNodeByType('wiki-draft', created.id));

    const afterParent = await execFileAsync('git', ['status', '--short', '--untracked-files=all'], {
      cwd: tempDir,
    });
    const afterVault = await execFileAsync('git', ['status', '--short', '--untracked-files=all'], {
      cwd: process.env.LLAAB_VAULT!,
    });

    expect(beforeParent.stdout).not.toContain('knowledge/wikis/repo-boundary.md');
    expect(afterParent.stdout).toContain('knowledge/wikis/repo-boundary.md');
    expect(beforeVault.stdout).toContain('nodes/wiki-drafts/repo-boundary-draft.md');
    expect(afterVault.stdout).toContain('nodes/wiki-drafts/repo-boundary-draft.md');
  });

  it('rejects promotion when proposed links are not promoted or evidence-backed', async () => {
    const { promoteCreateWikiDraft } = await import('./wiki-promotion.service.js');
    const draft = WikiDraftNodeSchema.parse({
      id: 'linked-draft',
      type: 'wiki-draft',
      title: 'Linked draft',
      tags: ['d:llm'],
      related: [],
      created_at: '2026-07-13T00:00:00Z',
      status: 'seed',
      body: '<!-- wiki-section:overview -->\\n\\n## Overview\\n\\nLinked.[^linked-ref]',
      topic_key: 'linked-page',
      operation: 'create',
      draft_status: 'proposed',
      proposed_links: [{ target_wiki_id: 'missing-page', relation: 'related-to', note: 'd:llm' }],
      source_refs: [{ id: 'linked-ref', kind: 'transcript', verification: 'source-backed' }],
    });

    await expect(promoteCreateWikiDraft(draft)).rejects.toThrow('Broken link: linked-page -> missing-page');
  });

  it('applies a second-transcript update without replacing manual sections and retries idempotently', async () => {
    const core = await import('@llaab/core');
    const { promoteUpdateWikiDraft } = await import('./wiki-promotion.service.js');
    const current = {
      id: 'context-management',
      type: 'wiki' as const,
      topic_key: 'context-management',
      title: 'Context',
      aliases: [],
      summary: 'Current',
      body: [
        '<!-- wiki-section:overview -->',
        '',
        '## Overview',
        '',
        'Original.[^first-transcript]',
        '',
        '<!-- wiki-section:manual -->',
        '',
        '## Manual',
        '',
        'Human addition.[^first-transcript]',
      ].join('\n'),
      status: 'seed' as const,
      tags: ['d:llm'],
      links: [],
      source_refs: [
        { id: 'first-transcript', kind: 'transcript' as const, verification: 'source-backed' as const },
      ],
      source_canonical_idea_ids: ['first-idea'],
      source_transcript_ids: ['first-transcript'],
      revision: 1,
      created_at: '2026-07-13T00:00:00Z',
      updated_at: '2026-07-13T00:00:00Z',
      verification_status: 'source-backed' as const,
    };
    await core.writeKnowledgeWiki(current);
    const draft = WikiDraftNodeSchema.parse({
      id: 'second-transcript-update',
      type: 'wiki-draft',
      title: 'Context',
      tags: ['d:llm'],
      related: [],
      created_at: '2026-07-13T00:00:00Z',
      status: 'seed',
      body: [
        '<!-- wiki-section:overview -->',
        '',
        '## Overview',
        '',
        'Updated from two transcripts.[^first-transcript] [^second-transcript]',
        '',
        '<!-- wiki-section:details -->',
        '',
        '## Details',
        '',
        'Second-transcript detail.[^second-transcript]',
      ].join('\n'),
      topic_key: 'context-management',
      target_wiki_id: 'context-management',
      operation: 'update',
      draft_status: 'proposed',
      source_canonical_idea_ids: ['second-idea'],
      source_transcript_ids: ['second-transcript'],
      source_ids: ['second-source'],
      source_refs: [{ id: 'second-transcript', kind: 'transcript', verification: 'source-backed' }],
      base_revision: current.revision,
      base_content_hash: core.hashKnowledgeWikiPage(current),
      patch: [
        { section_id: 'overview', operation: 'update', after: 'Updated from two transcripts.' },
        { section_id: 'manual', operation: 'unchanged' },
        { section_id: 'details', operation: 'add', after: 'Second-transcript detail.' },
      ],
    });
    const created = await core.createNode({
      type: 'wiki-draft',
      id: draft.id,
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

    const firstPromotion = await promoteUpdateWikiDraft(stored);
    expect(firstPromotion.page.revision).toBe(2);
    expect(firstPromotion.page.body).toContain('Updated from two transcripts.');
    expect(firstPromotion.page.body).toContain('Human addition.');
    expect(firstPromotion.page.body).toContain('Second-transcript detail.');
    expect(firstPromotion.page.source_transcript_ids).toEqual(['first-transcript', 'second-transcript']);

    const accepted = await core.readNodeByType('wiki-draft', stored.id);
    const retry = await promoteUpdateWikiDraft(accepted);
    expect(retry.page.revision).toBe(2);
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
