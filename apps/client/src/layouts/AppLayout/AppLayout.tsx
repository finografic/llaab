import { cn } from '@llaab/ui/lib/utils';
import { AppFooter } from 'components/AppFooter/AppFooter';
import { AppHeader } from 'components/AppHeader/AppHeader';
import { CanonicalIdeaConflictWatcher } from 'components/CanonicalIdeaConflictWatcher';
import { RunMonitor } from 'components/RunMonitor';
import { AppSidebarLayout } from 'components/ui/app-sidebar-dual-layout';
import { usePanelRef } from 'components/ui/resizable';
import { TooltipProvider } from 'components/ui/tooltip';
import { VaultGitPanel } from 'components/VaultGitPanel';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { Outlet, useMatches } from 'react-router-dom';
import type { AppLeftSidebarConfig } from './AppLeftSidebarContext';
import type { ReactNode, SetStateAction } from 'react';

import styles from './AppLayout.module.css';
import { AppLeftSidebarContext } from './AppLeftSidebarContext';
import { SecondaryActionBar } from './SecondaryActionBar';
import { SecondaryActionBarContext } from './SecondaryActionBarContext';

export interface RouteHandle {
  title?: string;
  fullBleed?: boolean;
}

/** Which panel currently occupies the single right-hand sidebar slot, if any. */
export type SecondaryPanel = 'runs' | 'vaultGit' | null;

interface LeftSidebarState {
  config: AppLeftSidebarConfig | null;
  isOpen: boolean;
}

type LeftSidebarAction =
  | { type: 'setConfig'; value: SetStateAction<AppLeftSidebarConfig | null> }
  | { type: 'setOpen'; open: boolean };

function leftSidebarReducer(state: LeftSidebarState, action: LeftSidebarAction): LeftSidebarState {
  if (action.type === 'setOpen') {
    return { ...state, isOpen: action.open };
  }

  const nextConfig = typeof action.value === 'function' ? action.value(state.config) : action.value;
  const isNewSidebar = nextConfig?.id !== state.config?.id;

  return {
    config: nextConfig,
    isOpen: isNewSidebar ? (nextConfig?.defaultOpen ?? false) : nextConfig !== null && state.isOpen,
  };
}

export function AppLayout() {
  const matches = useMatches();
  const handle = [...matches].toReversed().find((match) => match.handle)?.handle as RouteHandle | undefined;
  const { fullBleed = false } = handle ?? {};
  const leftSidebarPanelRef = usePanelRef();
  const rightSidebarPanelRef = usePanelRef();
  const [leftSidebarState, dispatchLeftSidebar] = useReducer(leftSidebarReducer, {
    config: null,
    isOpen: false,
  });
  const [activePanel, setActivePanel] = useState<SecondaryPanel>(null);
  const [leadingAction, setLeadingAction] = useState<ReactNode>(null);
  const leftSidebar = leftSidebarState.config;
  const isLeftSidebarOpen = leftSidebarState.isOpen;
  const setLeftSidebar = useCallback((value: SetStateAction<AppLeftSidebarConfig | null>) => {
    dispatchLeftSidebar({ type: 'setConfig', value });
  }, []);
  const setIsLeftSidebarOpen = useCallback((open: boolean) => {
    dispatchLeftSidebar({ type: 'setOpen', open });
  }, []);
  const leftSidebarValue = useMemo(() => ({ setLeftSidebar }), [setLeftSidebar]);
  const secondaryActionBarValue = useMemo(() => ({ setLeadingAction }), []);
  const isRightSidebarOpen = activePanel !== null;

  useEffect(() => {
    if (!leftSidebar) return;

    const animationFrame = window.requestAnimationFrame(() => {
      const panel = leftSidebarPanelRef.current;
      if (!panel) return;

      if (isLeftSidebarOpen) {
        panel.resize(leftSidebar.defaultWidth ?? '430px');
        return;
      }

      panel.collapse();
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [isLeftSidebarOpen, leftSidebar, leftSidebarPanelRef]);

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
            leftMinWidth={leftSidebar?.minWidth ?? '360px'}
            leftMaxWidth={leftSidebar?.maxWidth ?? '560px'}
            leftDefaultWidth={isLeftSidebarOpen ? (leftSidebar?.defaultWidth ?? '430px') : '0%'}
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
                hasLeftSidebar={leftSidebar !== null}
                isLeftSidebarOpen={isLeftSidebarOpen}
                onLeftSidebarOpenChange={setIsLeftSidebarOpen}
                activePanel={activePanel}
                onActivePanelChange={setActivePanel}
              />
            }
            leftSidebar={leftSidebar?.content}
            sidebar={
              activePanel === 'vaultGit' ? (
                <VaultGitPanel onClose={() => setActivePanel(null)} />
              ) : activePanel === 'runs' ? (
                <RunMonitor onClose={() => setActivePanel(null)} />
              ) : null
            }
          >
            <main className={cn(styles.pageContent, fullBleed && styles.pageContentBleed)}>
              <AppLeftSidebarContext.Provider value={leftSidebarValue}>
                <Outlet />
              </AppLeftSidebarContext.Provider>
            </main>
          </AppSidebarLayout>
        </TooltipProvider>
      </SecondaryActionBarContext.Provider>
      <AppFooter />
      <CanonicalIdeaConflictWatcher />
    </div>
  );
}
