import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('researchWiki', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'llaab-wiki-research-'));
    process.env.LLAAB_VAULT = join(tempDir, 'vault');
    process.env.LLAAB_KNOWLEDGE = join(tempDir, 'knowledge');
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.LLAAB_VAULT;
    delete process.env.LLAAB_KNOWLEDGE;
    await rm(tempDir, { force: true, recursive: true });
  });

  async function writeWiki() {
    const core = await import('@llaab/core');
    await core.writeKnowledgeWiki({
      id: 'context-management',
      type: 'wiki',
      topic_key: 'context-management',
      title: 'Context Management',
      aliases: [],
      summary: 'Current summary',
      body: '<!-- wiki-section:overview -->\n\n## Overview\n\nCurrent.[^transcript-ref]',
      status: 'seed',
      tags: ['d:llm'],
      links: [],
      source_refs: [{ id: 'transcript-ref', kind: 'transcript', verification: 'source-backed' }],
      source_canonical_idea_ids: ['context-idea'],
      source_transcript_ids: ['context-transcript'],
      revision: 1,
      created_at: '2026-07-13T00:00:00Z',
      updated_at: '2026-07-13T00:00:00Z',
      verification_status: 'source-backed',
    });
    return core;
  }

  function requireDraftId(draftId: string | undefined): string {
    expect(draftId).toBeDefined();
    return draftId!;
  }

  it('persists approved manual research as external draft evidence without writing knowledge', async () => {
    const core = await writeWiki();
    const { researchWiki } = await import('./research-wiki.js');

    const { record, result } = await researchWiki({
      wiki_id: 'context-management',
      query: 'context management primary source',
      provider: 'manual',
      max_results: 1,
      approval: true,
      results: [
        {
          title: 'Primary documentation',
          url: 'https://example.com/context',
          excerpt: 'External source supports the claim.',
          authoritative: true,
          validation_notes: [],
          supports_claim: 'Context management is source-backed.',
        },
      ],
    });

    expect(record.status).toBe('completed');
    expect(result.producedNodeIds).toEqual([result.draftId]);
    const draft = await core.readNodeByType('wiki-draft', requireDraftId(result.draftId));
    const externalRef = draft.source_refs.find((ref) => ref.kind === 'external');
    expect(externalRef).toMatchObject({
      title: 'Primary documentation',
      url: 'https://example.com/context',
      excerpt: 'External source supports the claim.',
      retrieval_query: 'context management primary source',
      retrieval_provider: 'manual',
      verification: 'corroborated',
      validation_notes: [],
    });
    expect((await core.readKnowledgeWiki('context-management')).revision).toBe(1);
  });

  it('turns contradictory evidence into a contested review proposal', async () => {
    const core = await writeWiki();
    const { researchWiki } = await import('./research-wiki.js');

    const { result } = await researchWiki({
      wiki_id: 'context-management',
      query: 'context management contradiction',
      provider: 'manual',
      max_results: 1,
      approval: true,
      results: [
        {
          title: 'Contradictory source',
          url: 'https://example.com/contradiction',
          excerpt: 'External source disputes the claim.',
          authoritative: true,
          validation_notes: [],
          contradicts_claim: 'Context management is always sufficient.',
        },
      ],
    });

    const draft = await core.readNodeByType('wiki-draft', requireDraftId(result.draftId));
    expect(draft.operation).toBe('needs-review');
    expect(draft.contested_claims).toEqual(['Context management is always sufficient.']);
    expect(draft.contested_claim_evidence[0]?.incoming_source_ref_ids).toHaveLength(1);
    expect(draft.validation_issues[0]?.code).toBe('external-contradiction');
  });

  it('keeps non-authoritative external results review-bound', async () => {
    const core = await writeWiki();
    const { researchWiki } = await import('./research-wiki.js');

    const { result } = await researchWiki({
      wiki_id: 'context-management',
      query: 'context management weak source',
      provider: 'manual',
      max_results: 1,
      approval: true,
      results: [
        {
          title: 'Weak source',
          url: 'https://example.com/weak',
          excerpt: 'Weak source discusses the claim.',
          authoritative: false,
          validation_notes: ['Secondary commentary, not an authoritative source.'],
        },
      ],
    });

    const draft = await core.readNodeByType('wiki-draft', requireDraftId(result.draftId));
    const externalRef = draft.source_refs.find((ref) => ref.kind === 'external');
    expect(draft.operation).toBe('needs-review');
    expect(externalRef?.verification).toBe('source-backed');
    expect(externalRef?.validation_notes).toContain('Source was not marked authoritative.');
    expect(draft.validation_issues[0]?.code).toBe('external-source-quality');
  });

  it('rejects unavailable providers and result budget overruns before writing evidence', async () => {
    const { researchWiki } = await import('./research-wiki.js');

    await expect(
      researchWiki({
        wiki_id: 'context-management',
        query: 'context management',
        provider: 'manual',
        max_results: 1,
        approval: false,
        results: [],
      } as never),
    ).rejects.toThrow();
    await expect(
      researchWiki({
        wiki_id: 'context-management',
        query: 'context management',
        provider: 'web',
        max_results: 1,
        approval: true,
        results: [],
      } as never),
    ).rejects.toThrow();
    await expect(
      researchWiki({
        wiki_id: 'context-management',
        query: 'context management',
        provider: 'manual',
        max_results: 1,
        approval: true,
        results: [
          {
            title: 'One',
            url: 'https://example.com/one',
            excerpt: 'One',
            authoritative: true,
            validation_notes: [],
          },
          {
            title: 'Two',
            url: 'https://example.com/two',
            excerpt: 'Two',
            authoritative: true,
            validation_notes: [],
          },
        ],
      }),
    ).rejects.toThrow('result budget');
  });
});
