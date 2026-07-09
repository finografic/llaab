import { Button } from 'components/ui/button';
import { Input } from 'components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'components/ui/select';

import {
  DEFAULT_INBOX_CAPTURE_FILTERS,
  INBOX_PLATFORM_FILTERS,
  INBOX_ROUTE_KIND_FILTERS,
} from 'lib/inbox-capture-filters';
import type {
  InboxAttentionFilter,
  InboxCaptureFilters as InboxCaptureFiltersState,
  InboxGroupBy,
  InboxSortOrder,
} from 'lib/inbox-capture-filters';
import { routeKindLabel } from 'lib/inbox-capture.utils';

import styles from './InboxCaptureFilters.module.css';

export interface InboxCaptureFiltersProps {
  filters: InboxCaptureFiltersState;
  statusOptions: string[];
  onChange: (next: InboxCaptureFiltersState) => void;
}

export function InboxCaptureFilters({ filters, statusOptions, onChange }: InboxCaptureFiltersProps) {
  const patch = (partial: Partial<InboxCaptureFiltersState>) => {
    onChange({ ...filters, ...partial });
  };

  return (
    <div className={styles.filters}>
      <div className={styles.row}>
        <div className={styles.fieldWide}>
          <label className={styles.label} htmlFor="inbox-search">
            Search
          </label>
          <Input
            id="inbox-search"
            value={filters.search}
            placeholder="Title, body, URL, file name, route…"
            onChange={(event) => patch({ search: event.target.value })}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Route kind</span>
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
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Platform</span>
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
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Status</span>
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
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <span className={styles.label}>Sort</span>
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
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Group by</span>
          <Select
            value={filters.groupBy}
            onValueChange={(value) => patch({ groupBy: (value ?? 'none') as InboxGroupBy })}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No grouping</SelectItem>
              <SelectItem value="route_kind">Route kind</SelectItem>
              <SelectItem value="platform">Source platform</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Attention</span>
          <Select
            value={filters.attention}
            onValueChange={(value) => patch({ attention: (value ?? 'all') as InboxAttentionFilter })}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All captures</SelectItem>
              <SelectItem value="needs_attention">Failed / raw / unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className={styles.actions}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(DEFAULT_INBOX_CAPTURE_FILTERS)}
          >
            Reset filters
          </Button>
        </div>
      </div>
    </div>
  );
}
