import { Button } from 'components/ui/button';
import { Pagination, PaginationContent, PaginationItem } from 'components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'components/ui/select';

import { PAGE_SIZE_OPTIONS, getPaginationItems } from './list-pagination.utils';
import styles from './ListPagination.module.css';

export interface ListPaginationProps {
  page: number;
  pageCount: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function ListPagination({
  page,
  pageCount,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: ListPaginationProps) {
  if (totalItems === 0 || pageCount <= 1) return null;

  const pageStart = (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, totalItems);

  return (
    <div className={styles.shell}>
      <p className={styles.summary}>
        <span className={styles.summaryRange}>
          {pageStart}-{pageEnd}
        </span>{' '}
        of {totalItems}
      </p>
      <Pagination className={styles.pager}>
        <PaginationContent className={styles.pageControls}>
          <PaginationItem>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
          </PaginationItem>
          {getPaginationItems(page, pageCount).map((item, index) => (
            <PaginationItem key={`${item}-${index}`}>
              {item === 'ellipsis' ? (
                <span className={styles.ellipsis}>...</span>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className={
                    item === page ? `${styles.pageButton} ${styles.pageButtonActive}` : styles.pageButton
                  }
                  aria-current={item === page ? 'page' : undefined}
                  onClick={() => onPageChange(item)}
                >
                  {item}
                </Button>
              )}
            </PaginationItem>
          ))}
          <PaginationItem>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={page >= pageCount}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
      <label className={styles.pageSizeControl}>
        <span>show</span>
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger size="sm" aria-label="Items per page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
    </div>
  );
}
