import type {
  CanonicalIdeaNode,
  IdeaNode,
  KnowledgeWikiPage,
  SourceNode,
  TranscriptNode,
  WikiDraftNode,
} from './index.js';

import { CanonicalIdeaNodeSchema } from './canonical-idea-node.schema.js';
import { IdeaNodeSchema } from './idea-node.schema.js';
import { KnowledgeWikiPageSchema } from './knowledge/wiki-page.schema.js';
import { SourceNodeSchema } from './source-node.schema.js';
import { TranscriptNodeSchema } from './transcript-node.schema.js';
import { WikiDraftNodeSchema } from './wiki-draft-node.schema.js';

export const WIKI_FIXTURE_TIMESTAMP = '2026-07-13T00:00:00Z';

export function createWikiFixtureSource(overrides: Partial<SourceNode> = {}): SourceNode {
  return SourceNodeSchema.parse({
    id: 'context-source',
    type: 'source',
    title: 'Context Source',
    tags: [],
    related: [],
    created_at: WIKI_FIXTURE_TIMESTAMP,
    status: 'seed',
    body: '',
    url: 'https://example.com/context-source',
    ...overrides,
  });
}

export function createWikiFixtureTranscript(overrides: Partial<TranscriptNode> = {}): TranscriptNode {
  return TranscriptNodeSchema.parse({
    id: 'context-transcript',
    type: 'transcript',
    title: 'Context Transcript',
    tags: ['d:llm'],
    related: [],
    created_at: WIKI_FIXTURE_TIMESTAMP,
    status: 'seed',
    body: '<!-- t:0:42 -->\n\nTargeted retrieval keeps agent context focused.',
    source_id: 'context-source',
    source_url: 'https://example.com/context-video',
    source_type: 'youtube',
    extracted_idea_ids: ['context-candidate-idea'],
    ...overrides,
  });
}

export function createWikiFixtureCandidateIdea(overrides: Partial<IdeaNode> = {}): IdeaNode {
  return IdeaNodeSchema.parse({
    id: 'context-candidate-idea',
    type: 'idea',
    title: 'Targeted retrieval keeps context focused',
    tags: ['d:llm'],
    related: ['context-transcript'],
    created_at: WIKI_FIXTURE_TIMESTAMP,
    status: 'seed',
    body: '',
    origin: 'extracted',
    source_id: 'context-transcript',
    ...overrides,
  });
}

export function createWikiFixtureCanonicalIdea(
  overrides: Partial<CanonicalIdeaNode> = {},
): CanonicalIdeaNode {
  return CanonicalIdeaNodeSchema.parse({
    id: 'context-idea',
    type: 'canonical-idea',
    title: 'Use targeted retrieval for agent context',
    tags: ['d:llm'],
    related: ['context-transcript'],
    created_at: WIKI_FIXTURE_TIMESTAMP,
    status: 'seed',
    body: 'Targeted retrieval reduces irrelevant context.',
    transcript_id: 'context-transcript',
    source_candidate_idea_ids: ['context-candidate-idea'],
    key_claims: ['Targeted retrieval reduces irrelevant context.'],
    ...overrides,
  });
}

export function createWikiFixtureDraft(overrides: Partial<WikiDraftNode> = {}): WikiDraftNode {
  return WikiDraftNodeSchema.parse({
    id: 'context-management-draft',
    type: 'wiki-draft',
    title: 'Context management draft',
    tags: ['d:llm'],
    related: [],
    created_at: WIKI_FIXTURE_TIMESTAMP,
    status: 'seed',
    body: '<!-- wiki-section:overview -->\n\n## Overview\n\nSource-backed draft.',
    topic_key: 'context-management',
    operation: 'create',
    draft_status: 'proposed',
    source_canonical_idea_ids: ['context-idea'],
    source_transcript_ids: ['context-transcript'],
    source_ids: ['context-source'],
    source_refs: [
      {
        id: 'context-transcript',
        kind: 'transcript',
        node_id: 'context-transcript',
        verification: 'source-backed',
      },
    ],
    represented_canonical_idea_ids: ['context-idea'],
    sections: [
      {
        id: 'overview',
        heading: 'Overview',
        body: 'Source-backed draft.',
        source_ref_ids: ['context-transcript'],
        source_canonical_idea_ids: ['context-idea'],
      },
    ],
    ...overrides,
  });
}

export function createKnowledgeWikiFixture(overrides: Partial<KnowledgeWikiPage> = {}): KnowledgeWikiPage {
  return KnowledgeWikiPageSchema.parse({
    id: 'context-management',
    type: 'wiki',
    topic_key: 'context-management',
    title: 'Context Management',
    aliases: ['Agent context'],
    summary: 'A source-backed topic-level synthesis.',
    body: '<!-- wiki-section:overview -->\n\n## Overview\n\nSource-backed synthesis.[^context-transcript]',
    status: 'seed',
    tags: ['d:llm'],
    links: [],
    source_refs: [
      {
        id: 'context-transcript',
        kind: 'transcript',
        node_id: 'context-transcript',
        verification: 'source-backed',
      },
    ],
    source_canonical_idea_ids: ['context-idea'],
    source_transcript_ids: ['context-transcript'],
    revision: 1,
    created_at: WIKI_FIXTURE_TIMESTAMP,
    updated_at: WIKI_FIXTURE_TIMESTAMP,
    verification_status: 'source-backed',
    ...overrides,
  });
}

export const wikiCompileScenarioFixtures = {
  duplicateTopic: createWikiFixtureDraft({ operation: 'needs-review' }),
  identicalEvidence: createWikiFixtureDraft({ operation: 'no-op' }),
  multiSourceGrowth: createWikiFixtureDraft({
    source_transcript_ids: ['context-transcript', 'retrieval-transcript'],
    source_ids: ['context-source', 'retrieval-source'],
  }),
  staleDraft: createWikiFixtureDraft({
    base_revision: 1,
    base_content_hash: 'a'.repeat(64),
    operation: 'update',
    target_wiki_id: 'context-management',
  }),
} as const;
