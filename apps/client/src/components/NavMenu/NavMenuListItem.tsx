import { cn } from '@llaab/ui/lib/utils';
import { NavigationMenuLink } from 'components/ui/navigation-menu';
import { LockIcon } from 'lucide-react';

import type { NavMenuItem } from 'lib/nav-menu.config';
import { isNavItemActive } from 'lib/nav-menu.utils';

interface NavMenuListItemProps {
  item: NavMenuItem;
  pathname: string;
  onNavigate?: () => void;
}

function NavMenuItemContent({ item }: { item: NavMenuItem }) {
  return (
    <>
      <div className="flex items-center gap-1.5 text-sm leading-none font-medium">
        {item.label}
        {!item.live ? (
          <>
            <LockIcon className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only"> (coming soon)</span>
          </>
        ) : null}
      </div>
      <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">{item.description}</p>
    </>
  );
}

export function NavMenuListItem({ item, pathname, onNavigate }: NavMenuListItemProps) {
  if (!item.live) {
    return (
      <li>
        <div
          className="pointer-events-none block select-none space-y-1 rounded-md p-3 opacity-50"
          aria-disabled="true"
        >
          <NavMenuItemContent item={item} />
        </div>
      </li>
    );
  }

  const active = isNavItemActive(pathname, item.href);

  return (
    <li>
      <NavigationMenuLink
        asChild
        active={active}
        className={cn(
          'flex flex-col items-start gap-1 rounded-md p-3 leading-none no-underline outline-none transition-colors',
          'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
          active && 'bg-accent/50',
        )}
      >
        <a href={item.href} onClick={onNavigate}>
          <NavMenuItemContent item={item} />
        </a>
      </NavigationMenuLink>
    </li>
  );
}

export function NavMenuMobileItem({ item, pathname, onNavigate }: NavMenuListItemProps) {
  if (!item.live) {
    return (
      <li>
        <div
          className="pointer-events-none block select-none space-y-0.5 rounded-md px-2 py-2.5 opacity-50"
          aria-disabled="true"
        >
          <NavMenuItemContent item={item} />
        </div>
      </li>
    );
  }

  const active = isNavItemActive(pathname, item.href);

  return (
    <li>
      <a
        href={item.href}
        className={cn(
          'block space-y-0.5 rounded-md px-2 py-2.5 no-underline transition-colors',
          'hover:bg-muted hover:text-foreground',
          active && 'bg-accent/20 text-foreground',
        )}
        aria-current={active ? 'page' : undefined}
        onClick={onNavigate}
      >
        <NavMenuItemContent item={item} />
      </a>
    </li>
  );
}
