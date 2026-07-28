import { cn } from '@llaab/ui/lib/utils';
import { LockIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { NAV_MENU_SECTIONS } from 'lib/nav-menu.config';
import { getActiveNavItemHref, getActiveNavSectionId } from 'lib/nav-menu.utils';

import styles from './SectionSubnav.module.css';

export function SectionSubnav() {
  const { pathname } = useLocation();
  const sectionId = getActiveNavSectionId(pathname);
  const section = sectionId ? NAV_MENU_SECTIONS.find((entry) => entry.id === sectionId) : undefined;
  const activeHref = section
    ? getActiveNavItemHref(
        pathname,
        section.items.filter((item) => item.live).map((item) => item.href),
      )
    : null;

  return (
    <nav className={styles.subnav} aria-label="Section">
      {section ? (
        <ul className={styles.list}>
          {section.items.map((item) => {
            if (!item.live) {
              return (
                <li key={item.href}>
                  <span className={cn(styles.disabled, 'text-base')} aria-disabled="true">
                    {item.label}
                    <LockIcon className={styles.lockIcon} aria-hidden="true" />
                    <span className="sr-only"> (coming soon)</span>
                  </span>
                </li>
              );
            }

            const active = activeHref === item.href;

            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={cn(styles.link, 'text-base', active && styles.linkActive)}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </nav>
  );
}
