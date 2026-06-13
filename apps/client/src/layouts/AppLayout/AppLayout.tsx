import { cn } from '@llaab/ui/lib/utils';
import { AppFooter } from 'components/AppFooter/AppFooter';
import { AppHeader } from 'components/AppHeader/AppHeader';
import { RunMonitor, RunMonitorTrigger } from 'components/RunMonitor';
import { AppSidebarLayout } from 'components/ui/app-sidebar-layout';
import { usePanelRef } from 'components/ui/resizable';
import { TooltipProvider } from 'components/ui/tooltip';
import { useRunMonitorState } from 'providers/RunMonitorProvider';
import { useEffect, useMemo, useState } from 'react';
import { Outlet, useMatches } from 'react-router-dom';
import type { ReactNode } from 'react';

import styles from './AppLayout.module.css';
import { SecondaryActionBarContext } from './SecondaryActionBarContext';

export interface RouteHandle {
  title?: string;
  fullBleed?: boolean;
}

export function AppLayout() {
  const matches = useMatches();
  const handle = [...matches].toReversed().find((match) => match.handle)?.handle as RouteHandle | undefined;
  const { title, fullBleed = false } = handle ?? {};
  const runMonitorPanelRef = usePanelRef();
  const { isOpen, setRunMonitorIsOpen } = useRunMonitorState();
  const [leadingAction, setLeadingAction] = useState<ReactNode>(null);
  const secondaryActionBarValue = useMemo(() => ({ setLeadingAction }), []);

  useEffect(() => {
    const panel = runMonitorPanelRef.current;
    if (!panel) return;

    if (isOpen) {
      panel.resize('430px');
      return;
    }

    panel.collapse();
  }, [isOpen, runMonitorPanelRef]);

  return (
    <div className={styles.appShell}>
      <AppHeader title={title} />
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
            sidebarPanelId="run-monitor-sidebar"
            mainPanelId="app-main"
            sidebarPanelRef={runMonitorPanelRef}
            onCollapse={() => setRunMonitorIsOpen(false)}
            onExpand={() => setRunMonitorIsOpen(true)}
            headerClassName={styles.secondaryBar}
            sidebarClassName={styles.runMonitorSidebar}
            insetClassName={styles.appInset}
            header={
              <div className={styles.secondaryActions}>
                <div className={styles.secondaryLeading}>{leadingAction}</div>
                <div className={styles.secondaryTrailing}>
                  <RunMonitorTrigger />
                </div>
              </div>
            }
            sidebar={<RunMonitor />}
          >
            <main className={cn(styles.pageContent, fullBleed && styles.pageContentBleed)}>
              <Outlet />
            </main>
            <AppFooter />
          </AppSidebarLayout>
        </TooltipProvider>
      </SecondaryActionBarContext.Provider>
    </div>
  );
}
