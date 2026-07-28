import { DomainFilterBar, FacetToggle } from 'components/DomainFilterBar/DomainFilterBar';
import { Button } from 'components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from 'components/ui/collapsible';
import { Col, Row } from 'components/ui/grid';
import { Input } from 'components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'components/ui/select';
import { RotateCcwIcon, SearchIcon, SlidersHorizontalIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { toggleDomainValue } from 'lib/domain-filters';
import type {
  KnowledgeWikiFacetOption,
  KnowledgeWikiFacets,
  KnowledgeWikiFiltersState,
  WikiSortOrder,
} from 'lib/knowledge-wiki-filters';
import {
  activeKnowledgeWikiFilterCount,
  DEFAULT_KNOWLEDGE_WIKI_FILTERS,
  WIKI_SORT_OPTIONS,
} from 'lib/knowledge-wiki-filters';

import styles from './KnowledgeWikiFilters.module.css';

const TOP_TOPIC_TAG_LIMIT = 20;

interface KnowledgeWikiFiltersProps {
  filters: KnowledgeWikiFiltersState;
  facets: KnowledgeWikiFacets;
  resultCount: number;
  totalCount: number;
  onChange: (next: KnowledgeWikiFiltersState) => void;
  /** Optional control on the result-count row (e.g. density toggle). */
  resultActions?: ReactNode;
}

export function KnowledgeWikiFilters({
  filters,
  facets,
  resultCount,
  totalCount,
  onChange,
  resultActions,
}: KnowledgeWikiFiltersProps) {
  const activeFilterCount = activeKnowledgeWikiFilterCount(filters);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(filters.topicTags.length > 0);
  const topicOptions = visibleTopicOptions(facets.topicTags, filters.topicTags);

  const patch = (partial: Partial<KnowledgeWikiFiltersState>) => {
    onChange({ ...filters, ...partial });
  };

  return (
    <div className={styles.filters}>
      <Row gutterWidth={8} align="flex-end">
        <Col xs={12} lg={4}>
          <label className={styles.label} htmlFor="wiki-search">
            Search wikis
          </label>
          <div className={styles.searchWrap}>
            <SearchIcon aria-hidden />
            <Input
              id="wiki-search"
              value={filters.search}
              placeholder="Title, summary, tags, aliases..."
              className={styles.searchInput}
              onChange={(event) => patch({ search: event.target.value })}
            />
          </div>
        </Col>

        <FilterCol label="Lifecycle">
          <Select
            value={filters.lifecycle}
            onValueChange={(value) =>
              patch({ lifecycle: (value ?? 'all') as KnowledgeWikiFiltersState['lifecycle'] })
            }
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All lifecycle states</SelectItem>
              {facets.lifecycle.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label} ({option.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterCol>

        <FilterCol label="Verification">
          <Select
            value={filters.verification}
            onValueChange={(value) =>
              patch({ verification: (value ?? 'all') as KnowledgeWikiFiltersState['verification'] })
            }
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All verification states</SelectItem>
              {facets.verification.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label} ({option.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterCol>

        <FilterCol label="Sort">
          <Select
            value={filters.sort}
            onValueChange={(value) => patch({ sort: (value ?? 'recently_updated') as WikiSortOrder })}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WIKI_SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterCol>

        <Col xs={12} lg={2}>
          <Collapsible open={moreFiltersOpen} onOpenChange={setMoreFiltersOpen}>
            <CollapsibleTrigger className={styles.filterToggle}>
              <SlidersHorizontalIcon aria-hidden />
              <span>More filters</span>
              {activeFilterCount > 0 ? (
                <span className={styles.activeFilterCount}>{activeFilterCount}</span>
              ) : null}
            </CollapsibleTrigger>
          </Collapsible>
        </Col>
      </Row>

      <DomainFilterBar
        className={styles.domainPanel}
        options={facets.domains}
        selected={filters.domains}
        onChange={(domains) => patch({ domains })}
      />

      <Collapsible open={moreFiltersOpen} onOpenChange={setMoreFiltersOpen}>
        <CollapsibleContent className={styles.moreFilters}>
          <Row gutterWidth={8} align="flex-start">
            <Col xs={12} lg={10}>
              <span className={styles.label}>Topic tags</span>
              {topicOptions.length > 0 ? (
                <Row gutterWidth={8} className={styles.topicGrid}>
                  {topicOptions.map((option) => (
                    <Col key={option.value} xs={6} md={4} lg={3} xl={2}>
                      <FacetToggle
                        option={option}
                        checked={filters.topicTags.includes(option.value)}
                        onCheckedChange={() =>
                          patch({ topicTags: toggleDomainValue(filters.topicTags, option.value) })
                        }
                      />
                    </Col>
                  ))}
                </Row>
              ) : (
                <p className={styles.emptyFilters}>No topic tags available yet.</p>
              )}
            </Col>
            <Col xs={12} lg={2} className={styles.resetCol}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={styles.resetButton}
                onClick={() => onChange(DEFAULT_KNOWLEDGE_WIKI_FILTERS)}
              >
                <RotateCcwIcon aria-hidden />
                Reset all
              </Button>
            </Col>
          </Row>
        </CollapsibleContent>
      </Collapsible>

      <ActiveFilterChips filters={filters} facets={facets} onChange={onChange} />

      <div className={styles.resultCountRow}>
        <p className={styles.resultCount}>
          {resultCount} shown
          {resultCount !== totalCount ? ` · ${totalCount} total` : null}
        </p>
        {resultActions ? <div className={styles.resultActions}>{resultActions}</div> : null}
      </div>
    </div>
  );
}

function FilterCol({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Col xs={12} sm={6} lg={2} className={styles.filterCol}>
      <span className={styles.label}>{label}</span>
      {children}
    </Col>
  );
}

function ActiveFilterChips({
  filters,
  facets,
  onChange,
}: {
  filters: KnowledgeWikiFiltersState;
  facets: KnowledgeWikiFacets;
  onChange: (next: KnowledgeWikiFiltersState) => void;
}) {
  const chips = [
    ...filters.domains.map((domain) => ({
      key: `domain:${domain}`,
      label: labelFor(facets.domains, domain),
      onRemove: () => onChange({ ...filters, domains: removeValue(filters.domains, domain) }),
    })),
    ...(filters.lifecycle !== 'all'
      ? [
          {
            key: `lifecycle:${filters.lifecycle}`,
            label: labelFor(facets.lifecycle, filters.lifecycle),
            onRemove: () => onChange({ ...filters, lifecycle: 'all' as const }),
          },
        ]
      : []),
    ...(filters.verification !== 'all'
      ? [
          {
            key: `verification:${filters.verification}`,
            label: labelFor(facets.verification, filters.verification),
            onRemove: () => onChange({ ...filters, verification: 'all' as const }),
          },
        ]
      : []),
    ...filters.topicTags.map((tag) => ({
      key: `topic:${tag}`,
      label: tag,
      onRemove: () => onChange({ ...filters, topicTags: removeValue(filters.topicTags, tag) }),
    })),
  ];

  // if (chips.length === 0 && !filters.search.trim()) return null;

  return (
    <Row gutterWidth={8} align="center" className={styles.activeChips}>
      {filters.search.trim() ? (
        <Col xs="content">
          <FilterChip
            label={`Search: ${filters.search.trim()}`}
            onRemove={() => onChange({ ...filters, search: '' })}
          />
        </Col>
      ) : null}
      {chips.map((chip) => (
        <Col key={chip.key} xs="content">
          <FilterChip label={chip.label} onRemove={chip.onRemove} />
        </Col>
      ))}
      <Col xs="content">
        {chips.length > 0 || Boolean(filters.search.trim()) ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={styles.clearAllButton}
            onClick={() => onChange(DEFAULT_KNOWLEDGE_WIKI_FILTERS)}
          >
            Clear all
          </Button>
        ) : null}
      </Col>
    </Row>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Button type="button" variant="outline" size="xs" className={styles.filterChip} onClick={onRemove}>
      {label}
      <XIcon aria-hidden />
    </Button>
  );
}

function visibleTopicOptions(
  topicTags: KnowledgeWikiFacetOption[],
  activeTags: string[],
): KnowledgeWikiFacetOption[] {
  const active = new Set(activeTags);
  return topicTags
    .filter((option, index) => index < TOP_TOPIC_TAG_LIMIT || active.has(option.value))
    .toSorted((a, b) => Number(active.has(b.value)) - Number(active.has(a.value)) || b.count - a.count);
}

function removeValue(values: string[], value: string): string[] {
  return values.filter((item) => item !== value);
}

function labelFor(options: KnowledgeWikiFacetOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}
