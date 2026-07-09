import { HermesInboxPlatformSchema, HermesInboxRouteKindSchema } from '@llaab/schemas';
import type { HermesInboxPlatform, HermesInboxRouteKind } from '@llaab/schemas';

import type { ParsedInboxCapture } from 'lib/inbox-capture.utils';
import { getInboxReviewState } from 'lib/inbox-review.utils';
import type { InboxReviewState } from 'lib/inbox-review.utils';

export const INBOX_ROUTE_KIND_FILTERS = HermesInboxRouteKindSchema.options;

export const INBOX_PLATFORM_FILTERS = HermesInboxPlatformSchema.options;

export const INBOX_REVIEW_STATE_FILTERS = [
  'new',
  'reviewed',
  'archived',
  'promoted',
  'failed',
] as const satisfies readonly InboxReviewState[];

export type InboxGroupBy = 'none' | 'route_kind' | 'platform';
export type InboxSortOrder = 'newest' | 'oldest';
export type InboxAttentionFilter = 'all' | 'needs_attention' | 'failed';

export interface InboxCaptureFilters {
  routeKind: HermesInboxRouteKind | 'all';
  platform: HermesInboxPlatform | 'all';
  status: string;
  reviewState: InboxReviewState | 'all';
  search: string;
  sort: InboxSortOrder;
  groupBy: InboxGroupBy;
  attention: InboxAttentionFilter;
}

export const DEFAULT_INBOX_CAPTURE_FILTERS: InboxCaptureFilters = {
  routeKind: 'all',
  platform: 'all',
  status: 'all',
  reviewState: 'all',
  search: '',
  sort: 'newest',
  groupBy: 'none',
  attention: 'all',
};

export interface InboxCaptureGroup {
  key: string;
  label: string;
  captures: ParsedInboxCapture[];
}

export function parseInboxFiltersFromSearchParams(params: URLSearchParams): InboxCaptureFilters {
  const routeKindRaw = params.get('kind') ?? 'all';
  const platformRaw = params.get('platform') ?? 'all';
  const status = params.get('status') ?? 'all';
  const reviewRaw = params.get('review') ?? 'all';
  const search = params.get('q') ?? '';
  const sortRaw = params.get('sort') ?? 'newest';
  const groupByRaw = params.get('group') ?? 'none';
  const attentionRaw = params.get('attention') ?? 'all';

  const routeKindParsed = HermesInboxRouteKindSchema.safeParse(routeKindRaw);
  const platformParsed = HermesInboxPlatformSchema.safeParse(platformRaw);
  const reviewState = INBOX_REVIEW_STATE_FILTERS.includes(reviewRaw as InboxReviewState)
    ? (reviewRaw as InboxReviewState)
    : 'all';

  return {
    routeKind: routeKindParsed.success ? routeKindParsed.data : 'all',
    platform: platformParsed.success ? platformParsed.data : 'all',
    status: status || 'all',
    reviewState,
    search,
    sort: sortRaw === 'oldest' ? 'oldest' : 'newest',
    groupBy: groupByRaw === 'route_kind' || groupByRaw === 'platform' ? groupByRaw : 'none',
    attention: attentionRaw === 'needs_attention' || attentionRaw === 'failed' ? attentionRaw : 'all',
  };
}

export function inboxFiltersToSearchParams(filters: InboxCaptureFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.routeKind !== 'all') params.set('kind', filters.routeKind);
  if (filters.platform !== 'all') params.set('platform', filters.platform);
  if (filters.status !== 'all') params.set('status', filters.status);
  if (filters.reviewState !== 'all') params.set('review', filters.reviewState);
  if (filters.search.trim()) params.set('q', filters.search.trim());
  if (filters.sort !== 'newest') params.set('sort', filters.sort);
  if (filters.groupBy !== 'none') params.set('group', filters.groupBy);
  if (filters.attention !== 'all') params.set('attention', filters.attention);
  return params;
}

export function filterInboxCaptures(
  captures: ParsedInboxCapture[],
  filters: InboxCaptureFilters,
): ParsedInboxCapture[] {
  const query = filters.search.trim().toLowerCase();

  const filtered = captures.filter((capture) => {
    if (filters.routeKind !== 'all' && capture.routeKind !== filters.routeKind) return false;
    if (filters.platform !== 'all' && capture.platform !== filters.platform) return false;
    if (filters.status !== 'all' && capture.node.status !== filters.status) return false;
    if (filters.reviewState !== 'all' && getInboxReviewState(capture.node) !== filters.reviewState) {
      return false;
    }
    if (filters.attention === 'needs_attention' && !needsAttention(capture)) return false;
    if (filters.attention === 'failed' && getInboxReviewState(capture.node) !== 'failed') return false;
    if (query && !matchesSearch(capture, query)) return false;
    return true;
  });

  return filtered.toSorted((a, b) => {
    const cmp = a.receivedAt.localeCompare(b.receivedAt);
    return filters.sort === 'newest' ? -cmp : cmp;
  });
}

export function groupInboxCaptures(
  captures: ParsedInboxCapture[],
  groupBy: InboxGroupBy,
): InboxCaptureGroup[] {
  if (groupBy === 'none') {
    return [{ key: 'all', label: 'All captures', captures }];
  }

  const map = new Map<string, ParsedInboxCapture[]>();
  for (const capture of captures) {
    const key = groupBy === 'route_kind' ? capture.routeKind : capture.platform;
    const list = map.get(key) ?? [];
    list.push(capture);
    map.set(key, list);
  }

  return [...map.entries()]
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([key, groupCaptures]) => ({
      key,
      label: key.replaceAll('_', ' '),
      captures: groupCaptures,
    }));
}

function needsAttention(capture: ParsedInboxCapture): boolean {
  const reviewState = getInboxReviewState(capture.node);
  if (reviewState === 'archived' || reviewState === 'promoted' || reviewState === 'reviewed') {
    return false;
  }
  if (reviewState === 'failed' || capture.malformed) return true;
  if (capture.routeKind === 'raw' || capture.routeKind === 'unknown') return true;
  if (capture.node.tags.includes('inbox:raw')) return true;
  return reviewState === 'new';
}

function matchesSearch(capture: ParsedInboxCapture, query: string): boolean {
  const haystacks: string[] = [
    capture.node.title,
    capture.rawText,
    capture.bodyWithoutJson,
    capture.routeKind,
    capture.platform,
    ...capture.node.tags,
  ];

  const payload = capture.provenance?.payload;
  if (payload) {
    for (const key of ['url', 'command', 'text', 'raw_text', 'label'] as const) {
      const value = payload[key];
      if (typeof value === 'string') haystacks.push(value);
    }
    const { attachment } = payload;
    if (attachment && typeof attachment === 'object' && !Array.isArray(attachment)) {
      const fileName = (attachment as Record<string, unknown>)['file_name'];
      if (typeof fileName === 'string') haystacks.push(fileName);
    }
  }

  return haystacks.some((value) => value.toLowerCase().includes(query));
}
