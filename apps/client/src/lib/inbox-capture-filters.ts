import { HermesInboxPlatformSchema, HermesInboxRouteKindSchema } from '@llaab/schemas';
import type { HermesInboxPlatform, HermesInboxRouteKind } from '@llaab/schemas';

import type { ParsedInboxCapture } from 'lib/inbox-capture.utils';
import { getInboxReviewState } from 'lib/inbox-review.utils';
import type { InboxReviewState } from 'lib/inbox-review.utils';

export const INBOX_ROUTE_KIND_FILTERS = HermesInboxRouteKindSchema.options;

export const INBOX_PLATFORM_FILTERS = HermesInboxPlatformSchema.options;

/** Review states offered in advanced filters. `failed` is legacy-only (never written). */
export const INBOX_REVIEW_STATE_FILTERS = [
  'new',
  'reviewed',
  'archived',
  'promoted',
] as const satisfies ReadonlyArray<Exclude<InboxReviewState, 'failed'>>;

/** URL/legacy values still accepted when parsing `?review=`. */
const INBOX_REVIEW_STATE_PARSE = [
  ...INBOX_REVIEW_STATE_FILTERS,
  'failed',
] as const satisfies readonly InboxReviewState[];

export type InboxGroupBy = 'category' | 'none' | 'route_kind' | 'platform';
export type InboxSortOrder = 'newest' | 'oldest';
export type InboxAttentionFilter = 'all' | 'needs_attention';
/** Primary triage scope control (not the content-kind "All" saved view). */
export type InboxReviewScope = 'unreviewed' | 'reviewed' | 'both';
export type InboxCaptureView =
  | 'all'
  | 'needs_attention'
  | 'action_backed'
  | 'links'
  | 'docs'
  | 'code'
  | 'attachments'
  | 'todos'
  | 'raw';

export const INBOX_REVIEW_SCOPES = [
  { value: 'unreviewed', label: 'Unreviewed' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'both', label: 'Both' },
] as const satisfies ReadonlyArray<{ value: InboxReviewScope; label: string }>;

export function reviewStateToScope(reviewState: InboxReviewState | 'all'): InboxReviewScope | '' {
  if (reviewState === 'new') return 'unreviewed';
  if (reviewState === 'reviewed') return 'reviewed';
  if (reviewState === 'all') return 'both';
  return '';
}

export function scopeToReviewState(scope: InboxReviewScope): InboxReviewState | 'all' {
  switch (scope) {
    case 'unreviewed':
      return 'new';
    case 'reviewed':
      return 'reviewed';
    case 'both':
      return 'all';
    default: {
      const _exhaustive: never = scope;
      return _exhaustive;
    }
  }
}

export const INBOX_CAPTURE_VIEWS = [
  { value: 'all', label: 'All' },
  { value: 'needs_attention', label: 'Needs attention' },
  { value: 'action_backed', label: 'Action-backed' },
  { value: 'links', label: 'Links' },
  { value: 'docs', label: 'Docs' },
  { value: 'code', label: 'Code' },
  { value: 'attachments', label: 'Attachments' },
  { value: 'todos', label: 'Todos' },
  { value: 'raw', label: 'Raw' },
] as const satisfies ReadonlyArray<{ value: InboxCaptureView; label: string }>;

const ACTION_BACKED_ROUTE_KINDS = new Set(['youtube_url', 'npm_package', 'github_repo']);
const LINK_ROUTE_KINDS = new Set([
  'youtube_url',
  'npm_package',
  'github_repo',
  'docs_link',
  'post_link',
  'web_link',
  'code_link',
]);
const DOCS_ROUTE_KINDS = new Set(['docs_link', 'docs_attachment']);
const CODE_ROUTE_KINDS = new Set(['code_snippet', 'code_link', 'code_attachment', 'command_candidate']);
const ATTACHMENT_ROUTE_KINDS = new Set(['image', 'attachment', 'docs_attachment', 'code_attachment']);

export interface InboxCaptureFilters {
  view: InboxCaptureView;
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
  view: 'all',
  routeKind: 'all',
  platform: 'all',
  status: 'all',
  reviewState: 'all',
  search: '',
  sort: 'newest',
  groupBy: 'category',
  attention: 'all',
};

export interface InboxCaptureGroup {
  key: string;
  label: string;
  captures: ParsedInboxCapture[];
}

export function parseInboxFiltersFromSearchParams(params: URLSearchParams): InboxCaptureFilters {
  const viewRaw = params.get('view') ?? 'all';
  const routeKindRaw = params.get('kind') ?? 'all';
  const platformRaw = params.get('platform') ?? 'all';
  const status = params.get('status') ?? 'all';
  const reviewRaw = params.get('review') ?? 'all';
  const search = params.get('q') ?? '';
  const sortRaw = params.get('sort') ?? 'newest';
  const groupByRaw = params.get('group') ?? 'category';
  const attentionRaw = params.get('attention') ?? 'all';

  const routeKindParsed = HermesInboxRouteKindSchema.safeParse(routeKindRaw);
  const platformParsed = HermesInboxPlatformSchema.safeParse(platformRaw);
  const reviewState = INBOX_REVIEW_STATE_PARSE.includes(reviewRaw as InboxReviewState)
    ? (reviewRaw as InboxReviewState)
    : 'all';

  return {
    view: INBOX_CAPTURE_VIEWS.some(({ value }) => value === viewRaw) ? (viewRaw as InboxCaptureView) : 'all',
    routeKind: routeKindParsed.success ? routeKindParsed.data : 'all',
    platform: platformParsed.success ? platformParsed.data : 'all',
    status: status || 'all',
    reviewState,
    search,
    sort: sortRaw === 'oldest' ? 'oldest' : 'newest',
    groupBy:
      groupByRaw === 'none' || groupByRaw === 'route_kind' || groupByRaw === 'platform'
        ? groupByRaw
        : 'category',
    attention: attentionRaw === 'needs_attention' ? attentionRaw : 'all',
  };
}

export function inboxFiltersToSearchParams(filters: InboxCaptureFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.view !== 'all') params.set('view', filters.view);
  if (filters.routeKind !== 'all') params.set('kind', filters.routeKind);
  if (filters.platform !== 'all') params.set('platform', filters.platform);
  if (filters.status !== 'all') params.set('status', filters.status);
  if (filters.reviewState !== 'all') params.set('review', filters.reviewState);
  if (filters.search.trim()) params.set('q', filters.search.trim());
  if (filters.sort !== 'newest') params.set('sort', filters.sort);
  if (filters.groupBy !== 'category') params.set('group', filters.groupBy);
  if (filters.attention !== 'all') params.set('attention', filters.attention);
  return params;
}

export function filterInboxCaptures(
  captures: ParsedInboxCapture[],
  filters: InboxCaptureFilters,
): ParsedInboxCapture[] {
  const query = filters.search.trim().toLowerCase();

  const filtered = captures.filter((capture) => {
    if (!matchesInboxCaptureView(capture, filters.view)) return false;
    if (filters.routeKind !== 'all' && capture.routeKind !== filters.routeKind) return false;
    if (filters.platform !== 'all' && capture.platform !== filters.platform) return false;
    if (filters.status !== 'all' && capture.node.status !== filters.status) return false;
    if (filters.reviewState !== 'all' && getInboxReviewState(capture.node) !== filters.reviewState) {
      return false;
    }
    if (filters.attention === 'needs_attention' && !inboxCaptureNeedsAttention(capture)) return false;
    if (query && !matchesSearch(capture, query)) return false;
    return true;
  });

  return filtered.toSorted((a, b) => {
    const cmp = a.receivedAt.localeCompare(b.receivedAt);
    return filters.sort === 'newest' ? -cmp : cmp;
  });
}

export function matchesInboxCaptureView(capture: ParsedInboxCapture, view: InboxCaptureView): boolean {
  switch (view) {
    case 'all':
      return true;
    case 'needs_attention':
      return inboxCaptureNeedsAttention(capture);
    case 'action_backed':
      return ACTION_BACKED_ROUTE_KINDS.has(capture.routeKind);
    case 'links':
      return LINK_ROUTE_KINDS.has(capture.routeKind);
    case 'docs':
      return DOCS_ROUTE_KINDS.has(capture.routeKind);
    case 'code':
      return CODE_ROUTE_KINDS.has(capture.routeKind);
    case 'attachments':
      return ATTACHMENT_ROUTE_KINDS.has(capture.routeKind);
    case 'todos':
      return capture.routeKind === 'todo';
    case 'raw':
      return capture.routeKind === 'raw' || capture.routeKind === 'unknown';
  }
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
    const key =
      groupBy === 'category'
        ? inboxCaptureCategory(capture)
        : groupBy === 'route_kind'
          ? capture.routeKind
          : capture.platform;
    const list = map.get(key) ?? [];
    list.push(capture);
    map.set(key, list);
  }

  return [...map.entries()]
    .toSorted(([a], [b]) =>
      groupBy === 'category' ? inboxCategoryRank(a) - inboxCategoryRank(b) : a.localeCompare(b),
    )
    .map(([key, groupCaptures]) => ({
      key,
      label: key.replaceAll('_', ' '),
      captures: groupCaptures,
    }));
}

function inboxCaptureCategory(capture: ParsedInboxCapture): string {
  if (capture.routeKind === 'raw' || capture.routeKind === 'unknown') return 'raw and unknown';
  if (ACTION_BACKED_ROUTE_KINDS.has(capture.routeKind)) return 'action-backed';
  if (DOCS_ROUTE_KINDS.has(capture.routeKind)) return 'docs and references';
  if (CODE_ROUTE_KINDS.has(capture.routeKind)) return 'code and commands';
  if (ATTACHMENT_ROUTE_KINDS.has(capture.routeKind)) return 'attachments and media';
  if (capture.routeKind === 'todo') return 'todos';
  if (LINK_ROUTE_KINDS.has(capture.routeKind)) return 'links';
  return 'other captures';
}

function inboxCategoryRank(category: string): number {
  return [
    'raw and unknown',
    'action-backed',
    'docs and references',
    'links',
    'code and commands',
    'attachments and media',
    'todos',
    'other captures',
  ].indexOf(category);
}

export function inboxCaptureNeedsAttention(capture: ParsedInboxCapture): boolean {
  const reviewState = getInboxReviewState(capture.node);
  if (reviewState === 'archived' || reviewState === 'promoted' || reviewState === 'reviewed') {
    return false;
  }
  // `failed` review tags are legacy-only (never written); still treat as attention if present.
  if (reviewState === 'failed' || capture.malformed) return true;
  if (capture.routeKind === 'raw' || capture.routeKind === 'unknown') return true;
  if (capture.node.tags.includes('inbox:raw')) return true;
  if (capture.routeKind === 'attachment') return true;
  if (capture.routeKind === 'image' && !captureHasMediaLocation(capture)) return true;
  return reviewState === 'new' && captureIsOlderThan(capture, 7);
}

function captureHasMediaLocation(capture: ParsedInboxCapture): boolean {
  const attachment = capture.provenance?.payload?.['attachment'];
  if (!attachment || typeof attachment !== 'object' || Array.isArray(attachment)) return false;
  const record = attachment as Record<string, unknown>;
  return Boolean(record['url'] || record['local_path']);
}

function captureIsOlderThan(capture: ParsedInboxCapture, days: number): boolean {
  const receivedAt = new Date(capture.receivedAt).getTime();
  return Number.isNaN(receivedAt) || Date.now() - receivedAt > days * 24 * 60 * 60 * 1000;
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
