import type { PaginationProviderProps } from './PaginationContext.types';

import { DISPLAY_NAME, PaginationContext as Pagination } from './PaginationContext';

export const PaginationProvider = ({ initialValue, children }: PaginationProviderProps) => {
  return <Pagination.Provider initialValue={initialValue}>{children}</Pagination.Provider>;
};

PaginationProvider.displayName = `${DISPLAY_NAME}Provider`;
