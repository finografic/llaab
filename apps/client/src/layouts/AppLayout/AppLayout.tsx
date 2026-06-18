import { cn } from '@llaab/ui/lib/utils';
import { AppFooter } from 'components/AppFooter/AppFooter';
import { AppHeader } from 'components/AppHeader/AppHeader';
import { RunMonitor } from 'components/RunMonitor';
import { AppSidebarLayout } from 'components/ui/app-sidebar-layout';
import { usePanelRef } from 'components/ui/resizable';
import { TooltipProvider } from 'components/ui/tooltip';
import { VaultGitPanel } from 'components/VaultGitPanel';
import { useEffect, useMemo, useState } from 'react';
import { Outlet, useMatches } from 'react-router-dom';
import type { ReactNode } from 'react';

import styles from './AppLayout.module.css';
import { SecondaryActionBar } from './SecondaryActionBar';
import { SecondaryActionBarContext } from './SecondaryActionBarContext';

export interface RouteHandle {
  title?: string;
  fullBleed?: boolean;
}

/** Which panel currently occupies the single right-hand sidebar slot, if any. */
export type SecondaryPanel = 'runs' | 'vaultGit' | null;

export function AppLayout() {
  const matches = useMatches();
  const handle = [...matches].toReversed().find((match) => match.handle)?.handle as RouteHandle | undefined;
  const { fullBleed = false } = handle ?? {};
  const sidebarPanelRef = usePanelRef();
  const [activePanel, setActivePanel] = useState<SecondaryPanel>(null);
  const [leadingAction, setLeadingAction] = useState<ReactNode>(null);
  const secondaryActionBarValue = useMemo(() => ({ setLeadingAction }), []);
  const isOpen = activePanel !== null;

  useEffect(() => {
    const panel = sidebarPanelRef.current;
    if (!panel) return;

    if (isOpen) {
      panel.resize('430px');
      return;
    }

    panel.collapse();
  }, [isOpen, sidebarPanelRef]);

  return (
    <div className={styles.appShell}>
      <AppHeader />
      <SecondaryActionBarContext.Provider value={secondaryActionBarValue}>
        <TooltipProvider>
          <AppSidebarLayout
            position="inline"
            align="right"
            resizable
            collapsible
            collapsedSize="0%"
            minWidth="360px"
            maxWidth="560px"
            defaultWidth={isOpen ? '430px' : '0%'}
            sidebarPanelId="secondary-sidebar"
            mainPanelId="app-main"
            sidebarPanelRef={sidebarPanelRef}
            onCollapse={() => setActivePanel(null)}
            onExpand={() => setActivePanel((prev) => prev ?? 'runs')}
            headerClassName={styles.secondaryBar}
            sidebarClassName={styles.runMonitorSidebar}
            insetClassName={styles.appInset}
            header={
              <SecondaryActionBar
                leadingAction={leadingAction}
                activePanel={activePanel}
                onActivePanelChange={setActivePanel}
              />
            }
            sidebar={
              activePanel === 'vaultGit' ? (
                <VaultGitPanel onClose={() => setActivePanel(null)} />
              ) : activePanel === 'runs' ? (
                <RunMonitor onClose={() => setActivePanel(null)} />
              ) : null
            }
          >
            <main className={cn(styles.pageContent, fullBleed && styles.pageContentBleed)}>
              <Outlet />
            </main>
          </AppSidebarLayout>
        </TooltipProvider>
      </SecondaryActionBarContext.Provider>
      <AppFooter />
    </div>
  );
}
