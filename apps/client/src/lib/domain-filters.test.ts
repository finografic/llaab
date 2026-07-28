import { describe, expect, it } from 'vitest';

import {
  buildDomainFacets,
  domainFacetLabel,
  domainFilterToSearchParam,
  filterByDomains,
  matchesDomainFilter,
  parseDomainFilterParam,
  toggleDomainValue,
  visibleTagsForList,
} from './domain-filters';

describe('domain-filters', () => {
  it('parses domain query params', () => {
    expect(parseDomainFilterParam('d:llm,d:meta')).toEqual(['d:llm', 'd:meta']);
    expect(parseDomainFilterParam('inbox,d:llm')).toEqual(['d:llm']);
    expect(parseDomainFilterParam(null)).toEqual([]);
  });

  it('serializes domain params', () => {
    expect(domainFilterToSearchParam(['d:meta', 'd:llm'])).toBe('d:llm,d:meta');
    expect(domainFilterToSearchParam([])).toBeNull();
  });

  it('OR-matches selected domains', () => {
    expect(matchesDomainFilter(['d:llm', 'hermes'], [])).toBe(true);
    expect(matchesDomainFilter(['d:llm', 'hermes'], ['d:llm'])).toBe(true);
    expect(matchesDomainFilter(['d:llm', 'hermes'], ['d:meta'])).toBe(false);
  });

  it('builds facets for known and unknown domains', () => {
    const facets = buildDomainFacets([['d:llm', 'd:future-domain'], ['d:llm', 'hermes'], ['d:meta']]);
    expect(facets).toEqual([
      { value: 'd:llm', label: 'LLM', count: 2 },
      { value: 'd:future-domain', label: 'Future Domain', count: 1 },
      { value: 'd:meta', label: 'Meta', count: 1 },
    ]);
  });

  it('filters items by domain', () => {
    const items = [
      { id: 'a', tags: ['d:llm'] },
      { id: 'b', tags: ['d:meta'] },
    ];
    expect(filterByDomains(items, ['d:llm']).map((item) => item.id)).toEqual(['a']);
  });

  it('toggles domain selection', () => {
    expect(toggleDomainValue(['d:llm'], 'd:meta')).toEqual(['d:llm', 'd:meta']);
    expect(toggleDomainValue(['d:llm', 'd:meta'], 'd:llm')).toEqual(['d:meta']);
  });

  it('labels unknown domains from slug', () => {
    expect(domainFacetLabel('d:foo-bar')).toBe('Foo Bar');
  });

  it('surfaces prioritized domain tags in compact list cells', () => {
    const tags = ['d:ingest', 'hermes', 'inbox', 'd:integration'];
    expect(visibleTagsForList(tags, { prioritize: ['d:integration'] })).toEqual([
      'd:integration',
      'd:ingest',
      'hermes',
    ]);
  });
});
