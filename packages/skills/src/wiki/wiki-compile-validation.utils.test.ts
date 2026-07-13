import { describe, expect, it } from 'vitest';
import type { WikiCompileResult } from '@llaab/schemas';

import {
  buildWikiSectionPatch,
  renderWikiDraftBody,
  validateWikiCompileResult,
} from './wiki-compile-validation.utils.js';

function result(overrides: Partial<WikiCompileResult> = {}): WikiCompileResult {
  return {
    operation: 'create',
    topic: { topic_key: 'targeted-retrieval', title: 'Targeted Retrieval', aliases: [] },
    summary: 'Summary',
    sections: [
      {
        id: 'overview',
        heading: 'Overview',
        body: 'Source-backed body.',
        source_ref_ids: ['transcript-ref'],
        source_canonical_idea_ids: ['canonical-idea'],
      },
    ],
    links: [],
    source_refs: [
      {
        id: 'transcript-ref',
        kind: 'transcript',
        node_id: 'transcript-node',
        url: 'https://example.com/transcript',
        verification: 'source-backed',
      },
    ],
    coverage: { represented_canonical_idea_ids: ['canonical-idea'], omitted_canonical_ideas: [] },
    change_summary: 'Create page.',
    unresolved_questions: [],
    contested_claims: [],
    ...overrides,
  };
}

function validate(candidate: WikiCompileResult) {
  return validateWikiCompileResult({
    result: candidate,
    canonicalIdeaIds: new Set(['canonical-idea']),
    allowedSourceRefs: new Map([
      [
        'transcript-ref',
        {
          node_id: 'transcript-node',
          url: 'https://example.com/transcript',
        },
      ],
    ]),
    allowedLinkTargetIds: new Set(),
    expectedTopicKey: 'targeted-retrieval',
    hasExistingWiki: false,
    sourceCount: 1,
  });
}

describe('wiki compile deterministic validation', () => {
  it('rejects model-invented URLs even when the source id is valid', () => {
    const candidate = result({
      source_refs: [
        {
          id: 'transcript-ref',
          kind: 'transcript',
          node_id: 'transcript-node',
          url: 'https://invented.example/source',
          verification: 'source-backed',
        },
      ],
    });

    expect(() => validate(candidate)).toThrow('changed source URL');
  });

  it('rejects duplicate sections and missing citations', () => {
    const duplicate = result();
    duplicate.sections.push({ ...duplicate.sections[0]! });
    expect(() => validate(duplicate)).toThrow('duplicate section id');

    const uncited = result();
    uncited.sections[0]!.source_ref_ids = [];
    expect(() => validate(uncited)).toThrow('has no source references');
  });

  it('returns structured quality issues and renders stable citations', () => {
    const candidate = result({ contested_claims: ['A contested claim.'] });
    const quality = validate(candidate);
    const body = renderWikiDraftBody(candidate);

    expect(quality.score).toBeLessThan(100);
    expect(quality.issues.map((issue) => issue.code)).toEqual(['single-source', 'contested-claims']);
    expect(body).toContain('<!-- wiki-section:overview -->');
    expect(body).toContain('[^transcript-ref]');
  });

  it('marks omitted existing sections as unchanged in update patches', () => {
    const existing = {
      id: 'targeted-retrieval',
      type: 'wiki' as const,
      topic_key: 'targeted-retrieval',
      title: 'Targeted Retrieval',
      aliases: [],
      summary: 'Existing',
      body: '<!-- wiki-section:overview -->\n\n## Overview\n\nOld.[^transcript-ref]\n\n<!-- wiki-section:manual -->\n\n## Manual\n\nKeep.[^transcript-ref]',
      status: 'seed' as const,
      tags: [],
      links: [],
      source_refs: result().source_refs,
      source_canonical_idea_ids: ['canonical-idea'],
      source_transcript_ids: ['transcript-node'],
      revision: 1,
      created_at: '2026-07-13T00:00:00Z',
      updated_at: '2026-07-13T00:00:00Z',
      verification_status: 'source-backed' as const,
    };

    expect(buildWikiSectionPatch(existing, result({ operation: 'update' }), 'update')).toContainEqual({
      section_id: 'manual',
      operation: 'unchanged',
    });
  });
});
