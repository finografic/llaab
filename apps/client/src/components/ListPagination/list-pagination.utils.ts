export const DEFAULT_PAGE_SIZE = 15;
export const PAGE_SIZE_OPTIONS = [DEFAULT_PAGE_SIZE, 50, 100] as const;

export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];
export type PageButtonItem = number | 'ellipsis';

export function normalizePageSize(value: number): PageSizeOption {
  return PAGE_SIZE_OPTIONS.includes(value as PageSizeOption) ? (value as PageSizeOption) : DEFAULT_PAGE_SIZE;
}

export function getPageCount(totalItems: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

export function clampPage(page: number, pageCount: number): number {
  return Math.min(Math.max(1, page), pageCount);
}

export function pageSliceBounds(page: number, pageSize: number): { start: number; end: number } {
  const start = (page - 1) * pageSize;
  return { start, end: start + pageSize };
}

export function getPaginationItems(page: number, pageCount: number): PageButtonItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const items: PageButtonItem[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);

  if (start > 2) items.push('ellipsis');
  for (let value = start; value <= end; value += 1) items.push(value);
  if (end < pageCount - 1) items.push('ellipsis');
  items.push(pageCount);

  return items;
}
