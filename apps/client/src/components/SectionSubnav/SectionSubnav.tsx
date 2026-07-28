import { cn } from '@llaab/ui/lib/utils';
import { RunMonitorTrigger } from 'components/RunMonitor';
import { Button } from 'components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from 'components/ui/tooltip';
import { VaultGitTrigger } from 'components/VaultGitPanel';
import { CleanVaultDialog } from 'dialogs/CleanVaultDialog/CleanVaultDialog';
import layoutStyles from 'layouts/AppLayout/AppLayout.module.css';
import { LockIcon, PanelLeftIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import type { SecondaryPanel } from 'layouts/AppLayout/AppLayout';
import type { ReactNode } from 'react';

import { NAV_MENU_SECTIONS } from 'lib/nav-menu.config';
import { getActiveNavItemHref, getActiveNavSectionId } from 'lib/nav-menu.utils';

import styles from './SectionSubnav.module.css';

export interface SectionSubnavProps {
  leadingAction?: ReactNode;
  hasLeftSidebar?: boolean;
  isLeftSidebarOpen?: boolean;
  onLeftSidebarOpenChange?: (open: boolean) => void;
  activePanel?: SecondaryPanel;
  onActivePanelChange?: (panel: SecondaryPanel) => void;
}

export function SectionSubnav({
  leadingAction = null,
  hasLeftSidebar = false,
  isLeftSidebarOpen = false,
  onLeftSidebarOpenChange,
  activePanel = null,
  onActivePanelChange,
}: SectionSubnavProps) {
  const { pathname } = useLocation();
  const sectionId = getActiveNavSectionId(pathname);
  const section = sectionId ? NAV_MENU_SECTIONS.find((entry) => entry.id === sectionId) : undefined;
  const activeHref = section
    ? getActiveNavItemHref(
        pathname,
        section.items.filter((item) => item.live).map((item) => item.href),
      )
    : null;

  const toggle = (panel: Exclude<SecondaryPanel, null>) => {
    onActivePanelChange?.(activePanel === panel ? null : panel);
  };

  const showLeading = hasLeftSidebar || leadingAction != null;

  return (
    <nav className={styles.subnav} aria-label="Section">
      {showLeading ? (
        <div className={styles.leading}>
          {hasLeftSidebar ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    layoutStyles.secondaryPanelTrigger,
                    isLeftSidebarOpen && layoutStyles.isActive,
                  )}
                  onClick={() => onLeftSidebarOpenChange?.(!isLeftSidebarOpen)}
                  aria-pressed={isLeftSidebarOpen}
                  aria-label="Toggle left sidebar"
                >
                  <PanelLeftIcon aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle left sidebar</TooltipContent>
            </Tooltip>
          ) : null}
          {leadingAction}
        </div>
      ) : null}

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
      ) : (
        <div className={styles.listSpacer} />
      )}

      <div className={styles.trailing}>
        <CleanVaultDialog resetIngestFormOnSuccess />
        <VaultGitTrigger isActive={activePanel === 'vaultGit'} onToggle={() => toggle('vaultGit')} />
        <RunMonitorTrigger isOpen={activePanel === 'runs'} onToggle={() => toggle('runs')} />
      </div>
    </nav>
  );
}
