import { computeWikiEvidenceMetrics } from '@llaab/schemas';
import type {
  KnowledgeWikiPage,
  WikiEvidenceMetrics,
  WikiLifecycleStatus,
  WikiVerificationStatus,
} from '@llaab/schemas';

export type WikiSortOrder =
  | 'recently_updated'
  | 'recently_created'
  | 'highest_quality'
  | 'most_evidence'
  | 'most_sources'
  | 'alphabetical';

export interface KnowledgeWikiFiltersState {
  search: string;
  domains: string[];
  lifecycle: WikiLifecycleStatus | 'all';
  verification: WikiVerificationStatus | 'all';
  topicTags: string[];
  sort: WikiSortOrder;
}

export interface KnowledgeWikiFacetOption {
  value: string;
  label: string;
  count: number;
}

export interface KnowledgeWikiFacets {
  domains: KnowledgeWikiFacetOption[];
  lifecycle: Array<KnowledgeWikiFacetOption & { value: WikiLifecycleStatus }>;
  verification: Array<KnowledgeWikiFacetOption & { value: WikiVerificationStatus }>;
  topicTags: KnowledgeWikiFacetOption[];
}

export const DEFAULT_KNOWLEDGE_WIKI_FILTERS: KnowledgeWikiFiltersState = {
  search: '',
  domains: [],
  lifecycle: 'all',
  verification: 'all',
  topicTags: [],
  sort: 'recently_updated',
};

export const WIKI_SORT_OPTIONS = [
  { value: 'recently_updated', label: 'Recently updated' },
  { value: 'recently_created', label: 'Recently created' },
  { value: 'highest_quality', label: 'Highest quality' },
  { value: 'most_evidence', label: 'Most evidence' },
  { value: 'most_sources', label: 'Most sources' },
  { value: 'alphabetical', label: 'Alphabetical' },
] as const satisfies ReadonlyArray<{ value: WikiSortOrder; label: string }>;

const DOMAIN_FILTERS = [
  { value: 'd:llm', label: 'LLM' },
  { value: 'd:automation', label: 'Automation' },
  { value: 'd:infra', label: 'Infrastructure' },
  { value: 'd:integration', label: 'Integration' },
  { value: 'd:schema', label: 'Schema' },
  { value: 'd:ingest', label: 'Ingest' },
  { value: 'd:ui', label: 'UI' },
  { value: 'd:meta', label: 'Meta' },
] as const;

const LIFECYCLE_OPTIONS = [
  { value: 'seed', label: 'Seed' },
  { value: 'growing', label: 'Growing' },
  { value: 'mature', label: 'Mature' },
] as const satisfies ReadonlyArray<{ value: WikiLifecycleStatus; label: string }>;

const VERIFICATION_OPTIONS = [
  { value: 'source-backed', label: 'Source-backed' },
  { value: 'corroborated', label: 'Corroborated' },
  { value: 'contested', label: 'Contested' },
] as const satisfies ReadonlyArray<{ value: WikiVerificationStatus; label: string }>;

const WIKI_SORT_VALUES = new Set<WikiSortOrder>(WIKI_SORT_OPTIONS.map((option) => option.value));
const LIFECYCLE_VALUES = new Set<WikiLifecycleStatus>(LIFECYCLE_OPTIONS.map((option) => option.value));
const VERIFICATION_VALUES = new Set<WikiVerificationStatus>(
  VERIFICATION_OPTIONS.map((option) => option.value),
);
const DOMAIN_VALUES = new Set<string>(DOMAIN_FILTERS.map((option) => option.value));

export function parseKnowledgeWikiFiltersFromSearchParams(
  params: URLSearchParams,
): KnowledgeWikiFiltersState {
  const lifecycleRaw = params.get('lifecycle');
  const verificationRaw = params.get('verification');
  const sortRaw = params.get('sort');

  return {
    search: params.get('q') ?? '',
    domains: parseListParam(params.get('domain')).filter((tag) => DOMAIN_VALUES.has(tag)),
    lifecycle: LIFECYCLE_VALUES.has(lifecycleRaw as WikiLifecycleStatus)
      ? (lifecycleRaw as WikiLifecycleStatus)
      : 'all',
    verification: VERIFICATION_VALUES.has(verificationRaw as WikiVerificationStatus)
      ? (verificationRaw as WikiVerificationStatus)
      : 'all',
    topicTags: parseListParam(params.get('topic')).filter((tag) => !tag.startsWith('d:')),
    sort: WIKI_SORT_VALUES.has(sortRaw as WikiSortOrder) ? (sortRaw as WikiSortOrder) : 'recently_updated',
  };
}

export function knowledgeWikiFiltersToSearchParams(filters: KnowledgeWikiFiltersState): URLSearchParams {
  const params = new URLSearchParams();
  const search = filters.search.trim();
  if (search) params.set('q', search);
  if (filters.domains.length > 0) params.set('domain', filters.domains.toSorted().join(','));
  if (filters.lifecycle !== 'all') params.set('lifecycle', filters.lifecycle);
  if (filters.verification !== 'all') params.set('verification', filters.verification);
  if (filters.topicTags.length > 0) params.set('topic', filters.topicTags.toSorted().join(','));
  if (filters.sort !== 'recently_updated') params.set('sort', filters.sort);
  return params;
}

export function buildKnowledgeWikiFacets(wikis: KnowledgeWikiPage[]): KnowledgeWikiFacets {
  const domainCounts = countValues(wikis.flatMap((wiki) => wiki.tags.filter((tag) => tag.startsWith('d:'))));
  const lifecycleCounts = countValues(wikis.map((wiki) => wiki.status));
  const verificationCounts = countValues(wikis.map((wiki) => wiki.verification_status));
  const topicCounts = countValues(wikis.flatMap((wiki) => wiki.tags.filter((tag) => !tag.startsWith('d:'))));

  return {
    domains: DOMAIN_FILTERS.map((option) => ({
      value: option.value,
      label: option.label,
      count: domainCounts.get(option.value) ?? 0,
    }))
      .filter((option) => option.count > 0)
      .toSorted((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    lifecycle: LIFECYCLE_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
      count: lifecycleCounts.get(option.value) ?? 0,
    })).filter((option) => option.count > 0),
    verification: VERIFICATION_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
      count: verificationCounts.get(option.value) ?? 0,
    })).filter((option) => option.count > 0),
    topicTags: [...topicCounts.entries()]
      .map(([value, count]) => ({ value, label: value, count }))
      .toSorted((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
  };
}

export function filterKnowledgeWikis(
  wikis: KnowledgeWikiPage[],
  filters: KnowledgeWikiFiltersState,
): KnowledgeWikiPage[] {
  const query = filters.search.trim().toLowerCase();

  return wikis
    .filter((wiki) => {
      if (query && !matchesWikiSearch(wiki, query)) return false;
      if (filters.domains.length > 0 && !filters.domains.some((domain) => wiki.tags.includes(domain))) {
        return false;
      }
      if (filters.lifecycle !== 'all' && wiki.status !== filters.lifecycle) return false;
      if (filters.verification !== 'all' && wiki.verification_status !== filters.verification) {
        return false;
      }
      if (filters.topicTags.length > 0 && !filters.topicTags.every((tag) => wiki.tags.includes(tag))) {
        return false;
      }
      return true;
    })
    .toSorted((a, b) => compareWikis(a, b, filters.sort));
}

export function resolveWikiEvidenceMetrics(wiki: KnowledgeWikiPage): WikiEvidenceMetrics {
  return (
    wiki.evidence_metrics ??
    computeWikiEvidenceMetrics(
      wiki.source_refs.map((ref) => ({
        id: ref.id,
        transcript_id: ref.kind === 'transcript' ? ref.node_id : undefined,
        source_id: ref.kind === 'source' ? ref.node_id : undefined,
        kind: ref.kind,
        url: ref.url,
        canonical_idea_ids: ref.kind === 'canonical-idea' && ref.node_id ? [ref.node_id] : [],
      })),
    )
  );
}

export function activeKnowledgeWikiFilterCount(filters: KnowledgeWikiFiltersState): number {
  return [
    filters.search.trim().length > 0,
    filters.domains.length > 0,
    filters.lifecycle !== 'all',
    filters.verification !== 'all',
    filters.topicTags.length > 0,
    filters.sort !== 'recently_updated',
  ].filter(Boolean).length;
}

function compareWikis(a: KnowledgeWikiPage, b: KnowledgeWikiPage, sort: WikiSortOrder): number {
  switch (sort) {
    case 'recently_created':
      return compareDateDesc(a.created_at, b.created_at);
    case 'highest_quality':
      return (b.quality_score ?? -1) - (a.quality_score ?? -1) || a.title.localeCompare(b.title);
    case 'most_evidence':
      return (
        resolveWikiEvidenceMetrics(b).evidence_ref_count - resolveWikiEvidenceMetrics(a).evidence_ref_count ||
        a.title.localeCompare(b.title)
      );
    case 'most_sources':
      return (
        resolveWikiEvidenceMetrics(b).independent_source_count -
          resolveWikiEvidenceMetrics(a).independent_source_count || a.title.localeCompare(b.title)
      );
    case 'alphabetical':
      return a.title.localeCompare(b.title);
    case 'recently_updated':
      return compareDateDesc(a.updated_at, b.updated_at);
  }
}

function matchesWikiSearch(wiki: KnowledgeWikiPage, query: string): boolean {
  return [wiki.title, wiki.summary, ...wiki.aliases, ...wiki.tags].some((value) =>
    value.toLowerCase().includes(query),
  );
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

function compareDateDesc(a: string, b: string): number {
  return b.localeCompare(a);
}
