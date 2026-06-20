import { cn } from '@llaab/ui/lib/utils';
import { AppFooter } from 'components/AppFooter/AppFooter';
import { AppHeader } from 'components/AppHeader/AppHeader';
import { CanonicalIdeaConflictWatcher } from 'components/CanonicalIdeaConflictWatcher';
import { RunMonitor } from 'components/RunMonitor';
import { AppSidebarLayout } from 'components/ui/app-sidebar-dual-layout';
import { Button } from 'components/ui/button';
import { usePanelRef } from 'components/ui/resizable';
import { TooltipProvider } from 'components/ui/tooltip';
import { VaultGitPanel } from 'components/VaultGitPanel';
import { XIcon } from 'lucide-react';
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

function LeftSidebarPanel({ onClose }: { onClose: () => void }) {
  return (
    <aside className={styles.leftPanel}>
      <header className={styles.leftPanelHeader}>
        <div>
          <h2 className={styles.leftPanelTitle}>Left Sidebar</h2>
          <p className={styles.leftPanelDescription}>Ready for the next navigation or context panel.</p>
        </div>
        <Button type="button" variant="ghost" size="icon" aria-label="Close left sidebar" onClick={onClose}>
          <XIcon aria-hidden />
        </Button>
      </header>
    </aside>
  );
}

export function AppLayout() {
  const matches = useMatches();
  const handle = [...matches].toReversed().find((match) => match.handle)?.handle as RouteHandle | undefined;
  const { fullBleed = false } = handle ?? {};
  const leftSidebarPanelRef = usePanelRef();
  const rightSidebarPanelRef = usePanelRef();
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<SecondaryPanel>(null);
  const [leadingAction, setLeadingAction] = useState<ReactNode>(null);
  const secondaryActionBarValue = useMemo(() => ({ setLeadingAction }), []);
  const isRightSidebarOpen = activePanel !== null;

  useEffect(() => {
    const panel = leftSidebarPanelRef.current;
    if (!panel) return;

    if (isLeftSidebarOpen) {
      panel.resize('430px');
      return;
    }

    panel.collapse();
  }, [isLeftSidebarOpen, leftSidebarPanelRef]);

  useEffect(() => {
    const panel = rightSidebarPanelRef.current;
    if (!panel) return;

    if (isRightSidebarOpen) {
      panel.resize('430px');
      return;
    }

    panel.collapse();
  }, [isRightSidebarOpen, rightSidebarPanelRef]);

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
            leftCollapsible
            leftCollapsedSize="0%"
            leftMinWidth="360px"
            leftMaxWidth="560px"
            leftDefaultWidth={isLeftSidebarOpen ? '430px' : '0%'}
            minWidth="360px"
            maxWidth="560px"
            defaultWidth={isRightSidebarOpen ? '430px' : '0%'}
            leftSidebarPanelId="primary-sidebar"
            sidebarPanelId="secondary-sidebar"
            mainPanelId="app-main"
            leftSidebarPanelRef={leftSidebarPanelRef}
            sidebarPanelRef={rightSidebarPanelRef}
            leftOnCollapse={() => setIsLeftSidebarOpen(false)}
            leftOnExpand={() => setIsLeftSidebarOpen(true)}
            onCollapse={() => setActivePanel(null)}
            onExpand={() => setActivePanel((prev) => prev ?? 'runs')}
            headerClassName={styles.secondaryBar}
            leftSidebarClassName={styles.leftSidebar}
            sidebarClassName={styles.runMonitorSidebar}
            insetClassName={styles.appInset}
            header={
              <SecondaryActionBar
                leadingAction={leadingAction}
                isLeftSidebarOpen={isLeftSidebarOpen}
                onLeftSidebarOpenChange={setIsLeftSidebarOpen}
                activePanel={activePanel}
                onActivePanelChange={setActivePanel}
              />
            }
            leftSidebar={<LeftSidebarPanel onClose={() => setIsLeftSidebarOpen(false)} />}
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
      <CanonicalIdeaConflictWatcher />
    </div>
  );
}
