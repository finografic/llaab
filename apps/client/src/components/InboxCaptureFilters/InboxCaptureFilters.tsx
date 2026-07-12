import { Badge } from 'components/ui/badge';
import { Button } from 'components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from 'components/ui/collapsible';
import { Col, Row } from 'components/ui/grid';
import { Input } from 'components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'components/ui/select';
import { Tabs, TabsList, TabsTrigger } from 'components/ui/tabs';
import { RotateCcwIcon, SearchIcon, SlidersHorizontalIcon } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import {
  DEFAULT_INBOX_CAPTURE_FILTERS,
  INBOX_CAPTURE_VIEWS,
  INBOX_PLATFORM_FILTERS,
  INBOX_REVIEW_STATE_FILTERS,
  INBOX_ROUTE_KIND_FILTERS,
} from 'lib/inbox-capture-filters';
import type {
  InboxAttentionFilter,
  InboxCaptureFilters as InboxCaptureFiltersState,
  InboxCaptureView,
  InboxGroupBy,
  InboxSortOrder,
} from 'lib/inbox-capture-filters';
import { routeKindLabel } from 'lib/inbox-capture.utils';
import type { InboxReviewState } from 'lib/inbox-review.utils';

import styles from './InboxCaptureFilters.module.css';

export interface InboxCaptureFiltersProps {
  filters: InboxCaptureFiltersState;
  statusOptions: string[];
  viewCounts: Record<InboxCaptureView, number>;
  onChange: (next: InboxCaptureFiltersState) => void;
}

export function InboxCaptureFilters({
  filters,
  statusOptions,
  viewCounts,
  onChange,
}: InboxCaptureFiltersProps) {
  const advancedFilterCount = countAdvancedFilters(filters);
  const [advancedOpen, setAdvancedOpen] = useState(advancedFilterCount > 0);

  const patch = (partial: Partial<InboxCaptureFiltersState>) => {
    onChange({ ...filters, ...partial });
  };

  const changeView = (view: InboxCaptureView) => {
    patch({ view, routeKind: 'all', attention: 'all' });
  };

  return (
    <div className={styles.filters}>
      <Tabs value={filters.view} onValueChange={(value) => changeView(value as InboxCaptureView)}>
        <TabsList variant="line" className={styles.viewTabs} aria-label="Inbox saved views">
          {INBOX_CAPTURE_VIEWS.map((view) => (
            <TabsTrigger key={view.value} value={view.value} className={styles.viewTab}>
              {view.label}
              <Badge variant="outline" className={styles.viewCount}>
                {viewCounts[view.value]}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Row gutterWidth={8} align="flex-end">
        <Col xs={12} md={9}>
          <label className={styles.label} htmlFor="inbox-search">
            Search captures
          </label>
          <div className={styles.searchWrap}>
            <SearchIcon aria-hidden />
            <Input
              id="inbox-search"
              value={filters.search}
              placeholder="Title, body, URL, file name, route…"
              className={styles.searchInput}
              onChange={(event) => patch({ search: event.target.value })}
            />
          </div>
        </Col>
        <Col xs={12} md={3}>
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger className={styles.filterToggle}>
              <SlidersHorizontalIcon aria-hidden />
              <span>Filters</span>
              {advancedFilterCount > 0 ? (
                <span className={styles.activeFilterCount}>{advancedFilterCount}</span>
              ) : null}
            </CollapsibleTrigger>
          </Collapsible>
        </Col>
      </Row>

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleContent className={styles.advancedFilters}>
          <Row gutterWidth={8} align="flex-end">
            <FilterCol label="Route kind">
              <Select
                value={filters.routeKind}
                onValueChange={(value) =>
                  patch({ routeKind: (value ?? 'all') as InboxCaptureFiltersState['routeKind'] })
                }
              >
                <SelectTrigger size="sm">
                  <SelectValue placeholder="All kinds" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All kinds</SelectItem>
                  {INBOX_ROUTE_KIND_FILTERS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {routeKindLabel(kind)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterCol>

            <FilterCol label="Platform">
              <Select
                value={filters.platform}
                onValueChange={(value) =>
                  patch({ platform: (value ?? 'all') as InboxCaptureFiltersState['platform'] })
                }
              >
                <SelectTrigger size="sm">
                  <SelectValue placeholder="All platforms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All platforms</SelectItem>
                  {INBOX_PLATFORM_FILTERS.map((platform) => (
                    <SelectItem key={platform} value={platform}>
                      {platform}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterCol>

            <FilterCol label="Node status">
              <Select value={filters.status} onValueChange={(value) => patch({ status: value ?? 'all' })}>
                <SelectTrigger size="sm">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterCol>

            <FilterCol label="Review">
              <Select
                value={filters.reviewState}
                onValueChange={(value) =>
                  patch({ reviewState: (value ?? 'all') as InboxReviewState | 'all' })
                }
              >
                <SelectTrigger size="sm">
                  <SelectValue placeholder="All review states" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All review states</SelectItem>
                  {INBOX_REVIEW_STATE_FILTERS.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterCol>

            <FilterCol label="Sort">
              <Select
                value={filters.sort}
                onValueChange={(value) => patch({ sort: (value ?? 'newest') as InboxSortOrder })}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                </SelectContent>
              </Select>
            </FilterCol>

            <FilterCol label="Group by">
              <Select
                value={filters.groupBy}
                onValueChange={(value) => patch({ groupBy: (value ?? 'category') as InboxGroupBy })}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="category">Capture category</SelectItem>
                  <SelectItem value="route_kind">Route kind</SelectItem>
                  <SelectItem value="platform">Source platform</SelectItem>
                  <SelectItem value="none">Flat list</SelectItem>
                </SelectContent>
              </Select>
            </FilterCol>

            <FilterCol label="Attention">
              <Select
                value={filters.attention}
                onValueChange={(value) => patch({ attention: (value ?? 'all') as InboxAttentionFilter })}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All captures</SelectItem>
                  <SelectItem value="needs_attention">Needs attention</SelectItem>
                  <SelectItem value="failed">Failed only</SelectItem>
                </SelectContent>
              </Select>
            </FilterCol>

            <Col xs={6} md={4} lg={3} xl={2} className={styles.resetCol}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={styles.resetButton}
                onClick={() => onChange(DEFAULT_INBOX_CAPTURE_FILTERS)}
              >
                <RotateCcwIcon aria-hidden />
                Reset all
              </Button>
            </Col>
          </Row>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function FilterCol({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Col xs={6} md={4} lg={3} xl={2} className={styles.filterCol}>
      <span className={styles.label}>{label}</span>
      {children}
    </Col>
  );
}

function countAdvancedFilters(filters: InboxCaptureFiltersState): number {
  return [
    filters.routeKind !== 'all',
    filters.platform !== 'all',
    filters.status !== 'all',
    filters.reviewState !== 'all',
    filters.sort !== 'newest',
    filters.groupBy !== 'category',
    filters.attention !== 'all',
  ].filter(Boolean).length;
}
