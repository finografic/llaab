import { describe, expect, it } from 'vitest';

import { KnowledgeWikiPageSchema } from './knowledge/wiki-page.schema.js';
import { NodeSchema } from './node.schema.js';
import {
  createWikiFixtureCanonicalIdea,
  createWikiFixtureDraft,
  createWikiFixtureTranscript,
  wikiCompileScenarioFixtures,
} from './wiki.fixtures.js';
import { WikiCompileResultSchema, WikiLinkSchema } from './wiki.schema.js';

const createdAt = '2026-07-13T00:00:00Z';

describe('wiki schemas', () => {
  it('accepts a vault wiki draft without treating promoted pages as LabNodes', () => {
    const draft = NodeSchema.parse(createWikiFixtureDraft());

    expect(draft.type).toBe('wiki-draft');
    expect(() =>
      NodeSchema.parse({
        id: 'context-management',
        type: 'wiki',
        title: 'Context management',
        created_at: createdAt,
      }),
    ).toThrow();
  });

  it('keeps deterministic fixtures for no-op, duplicate, multi-source, and stale-draft cases', () => {
    expect(wikiCompileScenarioFixtures.identicalEvidence.operation).toBe('no-op');
    expect(wikiCompileScenarioFixtures.duplicateTopic.operation).toBe('needs-review');
    expect(wikiCompileScenarioFixtures.multiSourceGrowth.source_transcript_ids).toHaveLength(2);
    expect(wikiCompileScenarioFixtures.staleDraft.base_content_hash).toHaveLength(64);
    expect(createWikiFixtureTranscript().body).toContain('<!-- t:0:42 -->');
    expect(createWikiFixtureCanonicalIdea().source_candidate_idea_ids).toEqual(['context-candidate-idea']);
  });

  it('requires resolved link targets and domain-only promoted tags', () => {
    expect(
      WikiLinkSchema.safeParse({ target_wiki_id: 'context-management', relation: 'extends' }).success,
    ).toBe(true);
    expect(WikiLinkSchema.safeParse({ target_wiki_id: '../escape', relation: 'extends' }).success).toBe(
      false,
    );

    expect(
      KnowledgeWikiPageSchema.safeParse({
        id: 'context-management',
        type: 'wiki',
        topic_key: 'context-management',
        title: 'Context Management',
        summary: 'A topic-level synthesis.',
        body: '<!-- wiki-section:overview -->\n\n## Overview\n\nUnicode proof: café.',
        status: 'seed',
        tags: ['d:llm'],
        revision: 1,
        created_at: createdAt,
        updated_at: createdAt,
        verification_status: 'source-backed',
      }).success,
    ).toBe(true);
    expect(
      KnowledgeWikiPageSchema.safeParse({
        id: 'context-management',
        type: 'wiki',
        topic_key: 'context-management',
        title: 'Context Management',
        summary: '',
        body: '',
        status: 'seed',
        tags: ['context-management'],
        revision: 1,
        created_at: createdAt,
        updated_at: createdAt,
        verification_status: 'source-backed',
      }).success,
    ).toBe(false);
  });

  it('requires every omitted canonical idea to retain a reason in compile output', () => {
    const result = WikiCompileResultSchema.safeParse({
      operation: 'create',
      topic: { topic_key: 'context-management', title: 'Context Management' },
      summary: 'A topic-level synthesis.',
      coverage: {
        represented_canonical_idea_ids: ['context-idea'],
        omitted_canonical_ideas: [{ id: 'unrelated-idea', reason: 'Outside the requested topic.' }],
      },
      change_summary: 'Creates a seed page.',
    });

    expect(result.success).toBe(true);
  });
});
