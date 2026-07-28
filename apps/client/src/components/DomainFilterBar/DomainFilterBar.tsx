import { SquareCheckIcon, SquareXIcon } from '@llaab/icons';
import { cn } from '@llaab/ui/lib/utils';
import { Badge } from 'components/ui/badge';
import { Button } from 'components/ui/button';
import { Checkbox } from 'components/ui/checkbox';
import { Col, Row } from 'components/ui/grid';

import type { DomainFacetOption } from 'lib/domain-filters';
import { toggleDomainValue } from 'lib/domain-filters';
import { domainTagStyle } from 'utils/domain-tag-color.utils';

import styles from './DomainFilterBar.module.css';

export interface DomainFilterBarProps {
  options: DomainFacetOption[];
  selected: string[];
  onChange: (domains: string[]) => void;
  /** Optional “N shown · M total” under the bar. */
  resultCount?: number;
  totalCount?: number;
  ariaLabel?: string;
  className?: string;
}

/** Colored domain (`d:*`) facet checkboxes — shared by wikis, nodes, and future lists. */
export function DomainFilterBar({
  options,
  selected,
  onChange,
  resultCount,
  totalCount,
  ariaLabel = 'Domain filters',
  className,
}: DomainFilterBarProps) {
  if (options.length === 0) return null;

  const showCount = resultCount != null && totalCount != null;
  const allValues = options.map((option) => option.value);
  const allSelected = allValues.length > 0 && allValues.every((value) => selected.includes(value));

  const toggleAll = () => {
    onChange(allSelected ? [] : allValues);
  };

  return (
    <div className={cn(styles.root, className)}>
      <section className={styles.panel} aria-label={ariaLabel}>
        <Row justify="space-between" align="center" gutterWidth={12} wrap="nowrap" className={styles.bar}>
          <Col xs="content" className={styles.facetsCol}>
            <Row gutterWidth={8} className={styles.grid} wrap="nowrap">
              {options.map((option) => (
                <Col key={option.value} xs="content">
                  <DomainFacetToggle
                    option={option}
                    checked={selected.includes(option.value)}
                    onCheckedChange={() => onChange(toggleDomainValue(selected, option.value))}
                  />
                </Col>
              ))}
            </Row>
          </Col>

          <Col xs="content" className={styles.toggleAllCol}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(styles.toggleAll, 'pr-0')}
              onClick={toggleAll}
              aria-label={allSelected ? 'Clear all domain filters' : 'Select all domain filters'}
              title={allSelected ? 'Clear all' : 'Select all'}
            >
              {allSelected ? (
                <SquareXIcon className={styles.toggleAllIcon} aria-hidden />
              ) : (
                <SquareCheckIcon className={styles.toggleAllIcon} aria-hidden />
              )}
              <span className={styles.toggleAllLabel}>{allSelected ? 'None' : 'All'}</span>
            </Button>
          </Col>
        </Row>
      </section>

      {showCount ? (
        <p className={styles.resultCount}>
          {resultCount} shown
          {resultCount !== totalCount ? ` · ${totalCount} total` : null}
        </p>
      ) : null}
    </div>
  );
}

export function DomainFacetToggle({
  option,
  checked,
  onCheckedChange,
}: {
  option: DomainFacetOption;
  checked: boolean;
  onCheckedChange: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={styles.facetButton}
      data-tag={option.value}
      data-active={checked || undefined}
      style={domainTagStyle(option.value)}
      onClick={onCheckedChange}
    >
      <Checkbox checked={checked} aria-hidden tabIndex={-1} />
      <span className={styles.facetLabel}>{option.label}</span>
      <Badge className={styles.facetCount}>{option.count}</Badge>
    </Button>
  );
}

/** Generic facet toggle without domain coloring (topic tags, etc.). */
export function FacetToggle({
  option,
  checked,
  onCheckedChange,
}: {
  option: DomainFacetOption;
  checked: boolean;
  onCheckedChange: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(styles.facetButton, styles.facetButtonWide)}
      data-active={checked || undefined}
      onClick={onCheckedChange}
    >
      <Checkbox checked={checked} aria-hidden tabIndex={-1} />
      <span className={styles.facetLabel}>{option.label}</span>
      <Badge variant="secondary" className={styles.facetCount}>
        {option.count}
      </Badge>
    </Button>
  );
}
