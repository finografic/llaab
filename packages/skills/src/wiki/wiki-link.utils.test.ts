import { describe, expect, it } from 'vitest';

import { parseWikiLinkSuggestions, validateWikiLinkSuggestions } from './wiki-link.utils.js';

describe('wiki-link validation', () => {
  const candidates = [
    {
      temporaryKey: 'isolation-boundaries',
      finalWikiId: 'isolation-boundaries',
      title: 'Isolation Boundaries',
      summary: 'Process isolation.',
      tags: ['d:agents', 'isolation'],
      operation: 'create' as const,
    },
    {
      temporaryKey: 'least-privilege',
      finalWikiId: 'least-privilege',
      title: 'Least Privilege',
      summary: 'Credential scoping.',
      tags: ['d:security', 'privilege'],
      operation: 'create' as const,
    },
  ];

  it('accepts semantic links and resolves temporary keys', () => {
    const result = validateWikiLinkSuggestions({
      suggestions: [
        {
          source_temporary_key: 'isolation-boundaries',
          target: 'least-privilege',
          relation: 'supports',
          note: 'Isolation reduces the blast radius of over-privileged tools.',
        },
      ],
      candidates,
      existingWikiIds: new Set(),
    });

    expect(result.rejected).toHaveLength(0);
    expect(result.linksBySourceKey.get('isolation-boundaries')).toEqual([
      {
        target_wiki_id: 'least-privilege',
        relation: 'supports',
        note: 'Isolation reduces the blast radius of over-privileged tools.',
      },
    ]);
  });

  it('rejects domain-only rationales, self-links, supersedes, and duplicates', () => {
    const result = validateWikiLinkSuggestions({
      suggestions: [
        {
          source_temporary_key: 'isolation-boundaries',
          target: 'isolation-boundaries',
          relation: 'related-to',
          note: 'Same topic.',
        },
        {
          source_temporary_key: 'isolation-boundaries',
          target: 'least-privilege',
          relation: 'supersedes',
          note: 'Replaces the older page.',
        },
        {
          source_temporary_key: 'isolation-boundaries',
          target: 'least-privilege',
          relation: 'related-to',
          note: 'd:agents',
        },
        {
          source_temporary_key: 'isolation-boundaries',
          target: 'least-privilege',
          relation: 'related-to',
          note: 'Tools that are isolated still need scoped credentials.',
        },
        {
          source_temporary_key: 'isolation-boundaries',
          target: 'least-privilege',
          relation: 'related-to',
          note: 'Duplicate edge.',
        },
      ],
      candidates,
      existingWikiIds: new Set(),
    });

    expect(result.linksBySourceKey.get('isolation-boundaries')).toHaveLength(1);
    expect(result.rejected.map((item) => item.reason).join(' ')).toMatch(
      /Self-links|Unsupported|domain\/tag|Duplicate/i,
    );
  });

  it('parses wrapped JSON link payloads', () => {
    const suggestions = parseWikiLinkSuggestions(
      JSON.stringify({
        links: [
          {
            source: 'isolation-boundaries',
            target_wiki_id: 'least-privilege',
            relation: 'depends-on',
            note: 'Privilege policy assumes isolation primitives exist.',
          },
        ],
      }),
    );
    expect(suggestions).toEqual([
      {
        source_temporary_key: 'isolation-boundaries',
        target: 'least-privilege',
        relation: 'depends-on',
        note: 'Privilege policy assumes isolation primitives exist.',
      },
    ]);
  });
});
