import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const routeLlm = vi.fn();

vi.mock('@llaab/llm', () => ({ routeLlm }));

describe('compileWikiDraft', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'llaab-wiki-compile-'));
    process.env.LLAAB_VAULT = join(tempDir, 'vault');
    vi.resetModules();
    routeLlm.mockReset();
  });

  afterEach(async () => {
    delete process.env.LLAAB_VAULT;
    await rm(tempDir, { force: true, recursive: true });
  });

  it('writes a source-backed vault draft and run without touching knowledge', async () => {
    routeLlm.mockImplementation(async (_task, prompt) => {
      const input = JSON.parse(prompt) as {
        evidence: Array<{ id: string }>;
        canonicalIdeas: Array<{ id: string }>;
      };
      return {
        text: JSON.stringify({
          operation: 'create',
          topic: { topic_key: 'targeted-retrieval', title: 'Targeted Retrieval', aliases: [] },
          summary: 'Focused retrieval improves context quality.',
          sections: [
            {
              id: 'overview',
              heading: 'Overview',
              body: 'Focused retrieval improves context quality.',
              source_ref_ids: [input.evidence[0]?.id],
              source_canonical_idea_ids: [input.canonicalIdeas[0]?.id],
            },
          ],
          links: [],
          source_refs: [{ id: input.evidence[0]?.id, kind: 'transcript', verification: 'source-backed' }],
          coverage: {
            represented_canonical_idea_ids: [input.canonicalIdeas[0]?.id],
            omitted_canonical_ideas: [],
          },
          change_summary: 'Creates a seed wiki.',
          unresolved_questions: [],
          contested_claims: [],
        }),
        model: 'test-model',
        provider: 'ollama',
        durationMs: 10,
      };
    });

    const core = await import('@llaab/core');
    const { compileWikiDraft } = await import('./compile-wiki-draft.js');
    const transcript = await core.createNode({
      type: 'transcript',
      title: 'Targeted retrieval',
      body: '<!-- t:0:42 -->\n\nFocused retrieval improves context quality.',
      extra: { source_url: 'https://example.com/video', source_type: 'youtube' },
    });
    const canonical = await core.createNode({
      type: 'idea',
      title: 'Targeted retrieval candidate',
      body: '',
      extra: { origin: 'extracted' },
    });
    const canonicalIdea = await core.createNode({
      type: 'canonical-idea',
      title: 'Targeted retrieval improves context',
      extra: { transcript_id: transcript.id, source_candidate_idea_ids: [canonical.id] },
    });

    const { record, result } = await compileWikiDraft({
      transcriptId: transcript.id,
      canonicalIdeaIds: [canonicalIdea.id],
      suggestedTopicKey: 'targeted-retrieval',
      entryPath: 'manual',
    });
    const draft = await core.readNodeByType('wiki-draft', result.draftId);

    expect(record.status).toBe('completed');
    expect(draft.source_transcript_ids).toEqual([transcript.id]);
    expect(draft.llm_model).toBe('test-model');
    expect(result.producedNodeIds).toEqual([draft.id]);
  });

  it('rejects duplicate selected canonical ids before inference', async () => {
    const { compileWikiDraft } = await import('./compile-wiki-draft.js');
    const result = await compileWikiDraft({
      transcriptId: 'missing',
      canonicalIdeaIds: ['idea', 'idea'],
      entryPath: 'manual',
    });

    expect(result.record.status).toBe('failed');
    expect(routeLlm).not.toHaveBeenCalled();
  });

  it('rejects mixed-transcript ids from the manual transcript flow before inference', async () => {
    const core = await import('@llaab/core');
    const { compileWikiDraft } = await import('./compile-wiki-draft.js');
    const first = await core.createNode({
      type: 'transcript',
      title: 'First transcript',
      extra: { source_url: 'https://example.com/first', source_type: 'other' },
    });
    const second = await core.createNode({
      type: 'transcript',
      title: 'Second transcript',
      extra: { source_url: 'https://example.com/second', source_type: 'other' },
    });
    const candidate = await core.createNode({
      type: 'idea',
      title: 'Candidate',
      extra: { origin: 'extracted' },
    });
    const firstIdea = await core.createNode({
      type: 'canonical-idea',
      title: 'First idea',
      extra: { transcript_id: first.id, source_candidate_idea_ids: [candidate.id] },
    });
    const secondIdea = await core.createNode({
      type: 'canonical-idea',
      title: 'Second idea',
      extra: { transcript_id: second.id, source_candidate_idea_ids: [candidate.id] },
    });

    const result = await compileWikiDraft({
      transcriptId: first.id,
      canonicalIdeaIds: [firstIdea.id, secondIdea.id],
      entryPath: 'manual',
    });

    expect(result.record.status).toBe('failed');
    expect(result.record.error).toContain('route transcript');
    expect(routeLlm).not.toHaveBeenCalled();
  });
});
