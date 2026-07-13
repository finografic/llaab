import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const routeLlm = vi.fn();
vi.mock('@llaab/llm', () => ({ routeLlm }));

function validModelOutput(prompt: string) {
  const input = JSON.parse(prompt) as {
    suggestedTopicKey: string;
    evidence: Array<{ id: string }>;
    canonicalIdeas: Array<{ id: string }>;
  };
  return {
    operation: 'create',
    topic: { topic_key: input.suggestedTopicKey, title: 'Route Test Wiki', aliases: [] },
    summary: 'A route-tested wiki draft.',
    sections: [
      {
        id: 'overview',
        heading: 'Overview',
        body: 'Source-backed route test.',
        source_ref_ids: [input.evidence[0]!.id],
        source_canonical_idea_ids: [input.canonicalIdeas[0]!.id],
      },
    ],
    links: [],
    source_refs: [{ id: input.evidence[0]!.id, kind: 'transcript', verification: 'source-backed' }],
    coverage: {
      represented_canonical_idea_ids: [input.canonicalIdeas[0]!.id],
      omitted_canonical_ideas: [],
    },
    change_summary: 'Creates a route-tested seed page.',
    unresolved_questions: [],
    contested_claims: [],
  };
}

describe('wiki draft routes', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'llaab-wiki-routes-'));
    process.env.LLAAB_VAULT = join(root, 'vault');
    process.env.LLAAB_KNOWLEDGE = join(root, 'knowledge');
    delete process.env.LLAAB_API_KEY;
    delete process.env.LLAAB_PASSWORD;
    delete process.env.VAULT_PASSWORD;
    routeLlm.mockReset();
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.LLAAB_VAULT;
    delete process.env.LLAAB_KNOWLEDGE;
    await rm(root, { force: true, recursive: true });
  });

  async function createLineage() {
    const core = await import('@llaab/core');
    const transcript = await core.createNode({
      type: 'transcript',
      title: 'Route test transcript',
      body: '<!-- t:0:42 -->\n\nSource-backed route test.',
      extra: {
        source_url: 'https://www.youtube.com/watch?v=route-test',
        source_type: 'youtube',
      },
    });
    const candidate = await core.createNode({
      type: 'idea',
      title: 'Route candidate',
      extra: { origin: 'extracted' },
    });
    const canonical = await core.createNode({
      type: 'canonical-idea',
      title: 'Route test wiki',
      extra: { transcript_id: transcript.id, source_candidate_idea_ids: [candidate.id] },
    });
    return { core, transcript, canonical };
  }

  async function postDraft(transcriptId: string, body: unknown) {
    const { app } = await import('../../app.js');
    return app.request(`/api/vault/transcripts/${transcriptId}/wiki-drafts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('rejects invalid selection, missing lineage, and unsafe targets before inference', async () => {
    expect((await postDraft('missing', { canonical_idea_ids: [] })).status).toBe(400);
    expect(
      (
        await postDraft('missing', {
          canonical_idea_ids: ['missing-idea'],
          target_wiki_id: '../unsafe',
        })
      ).status,
    ).toBe(400);
    expect((await postDraft('missing', { canonical_idea_ids: ['missing-idea'] })).status).toBe(500);
    expect(routeLlm).not.toHaveBeenCalled();
  });

  it('persists a one-source seed draft and returns its run and draft ids', async () => {
    const { core, transcript, canonical } = await createLineage();
    routeLlm.mockImplementation(async (_task, prompt) => ({
      text: JSON.stringify(validModelOutput(prompt)),
      model: 'test-model',
      provider: 'ollama',
      durationMs: 5,
    }));

    const response = await postDraft(transcript.id, {
      canonical_idea_ids: [canonical.id],
      suggested_topic_key: 'route-test-wiki',
    });
    const body = (await response.json()) as { draftId: string; runId: string };
    const draft = await core.readNodeByType('wiki-draft', body.draftId);
    const run = await core.readNodeByType('run', body.runId);

    expect(response.status).toBe(201);
    expect(draft.quality_score).toBeLessThan(100);
    expect(draft.validation_issues.map((issue) => issue.code)).toContain('single-source');
    expect(run.produced_node_ids).toEqual([draft.id]);

    const { app } = await import('../../app.js');
    const regenerateResponse = await app.request(`/api/vault/wiki-drafts/${draft.id}/regenerate`, {
      method: 'POST',
    });
    const regenerated = (await regenerateResponse.json()) as { draftId: string };
    expect(regenerateResponse.status).toBe(201);
    expect(regenerated.draftId).not.toBe(draft.id);
    expect((await core.readNodeByType('wiki-draft', draft.id)).draft_status).toBe('superseded');
    expect((await core.readNodeByType('wiki-draft', regenerated.draftId)).draft_status).toBe('proposed');
  });

  it('retries once and returns a failed route response when citations remain invalid', async () => {
    const { transcript, canonical } = await createLineage();
    routeLlm.mockImplementation(async (_task, prompt) => {
      const output = validModelOutput(prompt);
      output.sections[0]!.source_ref_ids = [];
      return {
        text: JSON.stringify(output),
        model: 'test-model',
        provider: 'ollama',
        durationMs: 5,
      };
    });

    const response = await postDraft(transcript.id, {
      canonical_idea_ids: [canonical.id],
      suggested_topic_key: 'route-test-wiki',
    });

    expect(response.status).toBe(500);
    expect(routeLlm).toHaveBeenCalledTimes(2);
  });
});
