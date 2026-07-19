import { describe, expect, it } from 'vitest';

import {
  evaluateWikiCompileCoherence,
  hasMechanicalIdeaHeadings,
  hasTerminalCoherenceFailure,
  isFixableWikiCompileFailure,
  isSourceShapedWikiTitle,
} from './wiki-compile-coherence.utils.js';

describe('wiki compile coherence', () => {
  it('flags source-shaped titles', () => {
    expect(isSourceShapedWikiTitle('Hermes transcript notes')).toBe(true);
    expect(isSourceShapedWikiTitle('Process Isolation Boundaries')).toBe(false);
    expect(
      isSourceShapedWikiTitle('Notes from Multi-Agent Systems', {
        transcriptTitle: 'Multi-Agent Systems',
      }),
    ).toBe(true);
  });

  it('detects mechanical one-section-per-idea headings', () => {
    expect(
      hasMechanicalIdeaHeadings({
        sections: [{ heading: 'Isolation Boundaries' }, { heading: 'V8 Snapshot Isolation' }],
        primaryIdeaTitles: ['Isolation Boundaries', 'V8 Snapshot Isolation'],
      }),
    ).toBe(true);

    expect(
      hasMechanicalIdeaHeadings({
        sections: [{ heading: 'Why isolation matters' }, { heading: 'Runtime trade-offs' }],
        primaryIdeaTitles: ['Isolation Boundaries', 'V8 Snapshot Isolation'],
      }),
    ).toBe(false);
  });

  it('classifies fixable vs terminal failures', () => {
    expect(isFixableWikiCompileFailure('Wiki compiler returned malformed or truncated JSON.')).toBe(true);
    expect(hasTerminalCoherenceFailure([{ code: 'mechanical-idea-headings', message: 'mechanical' }])).toBe(
      true,
    );

    const issues = evaluateWikiCompileCoherence({
      result: {
        operation: 'create',
        topic: { topic_key: 'hermes-digest', title: 'Hermes YouTube transcript', aliases: [] },
        summary: 'Summary',
        sections: [
          {
            id: 'isolation-boundaries',
            heading: 'Isolation Boundaries',
            body: 'Body',
            source_ref_ids: ['ref-1'],
            source_canonical_idea_ids: ['idea-1'],
          },
          {
            id: 'v8-snapshot-isolation',
            heading: 'V8 Snapshot Isolation',
            body: 'Body',
            source_ref_ids: ['ref-1'],
            source_canonical_idea_ids: ['idea-2'],
          },
        ],
        links: [],
        source_refs: [],
        coverage: {
          represented_canonical_idea_ids: ['idea-1', 'idea-2'],
          omitted_canonical_ideas: [],
        },
        change_summary: 'Change',
        unresolved_questions: [],
        contested_claims: [],
      },
      primaryIdeaTitles: ['Isolation Boundaries', 'V8 Snapshot Isolation'],
    });

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['source-shaped-title', 'mechanical-idea-headings']),
    );
  });
});
