import { useEffect } from 'react';

/** Sync `document.title` with the current page label. */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} — LLAAB` : 'LLAAB';
  }, [title]);
}
