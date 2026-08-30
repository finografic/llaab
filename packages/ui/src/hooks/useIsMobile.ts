/**
 * Re-exported so `hooks/useIsMobile` keeps working across the repo.
 *
 * The implementation lives in `@finografic/react`, which reads the `md` boundary from
 * `@finografic/core/viewport` — the same source that generates Tailwind's `@theme` block,
 * so the hook and the CSS cannot disagree about where mobile ends.
 */

export { useIsMobile } from '@finografic/react';
