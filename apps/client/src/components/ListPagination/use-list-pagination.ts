import { usePersistedUiState } from 'queries/ui-state';
import { useEffect, useMemo, useState } from 'react';

import {
  DEFAULT_PAGE_SIZE,
  clampPage,
  getPageCount,
  normalizePageSize,
  pageSliceBounds,
} from './list-pagination.utils';

export interface UseListPaginationInput<T> {
  items: readonly T[];
  storageKey: string;
  resetKey?: string;
}

export interface UseListPaginationReturn<T> {
  page: number;
  pageCount: number;
  pageItems: readonly T[];
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
}

export function useListPagination<T>({
  items,
  storageKey,
  resetKey,
}: UseListPaginationInput<T>): UseListPaginationReturn<T> {
  const { value: rawPageSize, setValue: setRawPageSize } = usePersistedUiState<number>(
    storageKey,
    DEFAULT_PAGE_SIZE,
  );
  const pageSize = normalizePageSize(rawPageSize);
  const [page, setPage] = useState(1);
  const pageCount = getPageCount(items.length, pageSize);
  const clampedPage = clampPage(page, pageCount);

  useEffect(() => {
    setPage(1);
  }, [pageSize, resetKey]);

  useEffect(() => {
    setPage((current) => clampPage(current, pageCount));
  }, [pageCount]);

  const pageItems = useMemo(() => {
    const { start, end } = pageSliceBounds(clampedPage, pageSize);
    return items.slice(start, end);
  }, [clampedPage, items, pageSize]);

  return {
    page: clampedPage,
    pageCount,
    pageItems,
    pageSize,
    setPage,
    setPageSize: setRawPageSize,
  };
}
