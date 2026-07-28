import { isDomainTag } from 'utils/domain-tag-color.utils';

/** Canonical domain filter catalog (labels for known `d:*` tags). */
export const DOMAIN_FILTER_OPTIONS = [
  { value: 'd:llm', label: 'LLM' },
  { value: 'd:automation', label: 'Automation' },
  { value: 'd:infra', label: 'Infrastructure' },
  { value: 'd:integration', label: 'Integration' },
  { value: 'd:schema', label: 'Schema' },
  { value: 'd:ingest', label: 'Ingest' },
  { value: 'd:ui', label: 'UI' },
  { value: 'd:meta', label: 'Meta' },
] as const;

export interface DomainFacetOption {
  value: string;
  label: string;
  count: number;
}

const KNOWN_DOMAIN_LABELS = new Map<string, string>(
  DOMAIN_FILTER_OPTIONS.map((option) => [option.value, option.label]),
);

/** Parse `?domain=d:llm,d:meta` — any `d:*` tag is accepted. */
export function parseDomainFilterParam(raw: string | null): string[] {
  return parseListParam(raw).filter(isDomainTag);
}

export function domainFilterToSearchParam(domains: string[]): string | null {
  if (domains.length === 0) return null;
  return domains.toSorted().join(',');
}

/** OR-match: item matches if it carries any selected domain tag. Empty selection = all. */
export function matchesDomainFilter(tags: readonly string[], selected: readonly string[]): boolean {
  if (selected.length === 0) return true;
  return selected.some((domain) => tags.includes(domain));
}

export function filterByDomains<T extends { tags: readonly string[] }>(
  items: readonly T[],
  selected: readonly string[],
): T[] {
  if (selected.length === 0) return [...items];
  return items.filter((item) => matchesDomainFilter(item.tags, selected));
}

export function toggleDomainValue(values: readonly string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

/**
 * Build domain facet options from tag lists.
 * Known domains keep catalog labels; any other `d:*` present in data is included automatically.
 */
export function buildDomainFacets(tagLists: Iterable<readonly string[]>): DomainFacetOption[] {
  const domainTags: string[] = [];
  for (const tags of tagLists) {
    for (const tag of tags) {
      if (isDomainTag(tag)) domainTags.push(tag);
    }
  }

  const counts = countValues(domainTags);
  const options: DomainFacetOption[] = [];
  const seen = new Set<string>();

  for (const option of DOMAIN_FILTER_OPTIONS) {
    const count = counts.get(option.value) ?? 0;
    if (count === 0) continue;
    options.push({ value: option.value, label: option.label, count });
    seen.add(option.value);
  }

  for (const [value, count] of counts) {
    if (seen.has(value) || count === 0) continue;
    options.push({ value, label: domainFacetLabel(value), count });
  }

  return options.toSorted((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function domainFacetLabel(tag: string): string {
  const known = KNOWN_DOMAIN_LABELS.get(tag);
  if (known) return known;
  const slug = tag.startsWith('d:') ? tag.slice(2) : tag;
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function countValues(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function parseListParam(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
