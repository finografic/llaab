import { cn } from '@llaab/ui/lib/utils';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface IconHeadingProps {
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}

/**
 * Icon-prefixed title — the icon is sized in `em` so it always matches whatever
 * font-size it's dropped into (card title, sidebar section label, page title, page
 * section heading); color/weight/spacing come from the surrounding element's own
 * styles, not from this component.
 */
export function IconHeading({ icon: Icon, children, className }: IconHeadingProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Icon className="size-[1em] shrink-0" aria-hidden />
      {children}
    </span>
  );
}
