import { AppSidebarLayout } from 'components/ui/app-sidebar-layout';
import { Button } from 'components/ui/button';
import { usePanelRef } from 'components/ui/resizable';
import { useSecondaryActionBar } from 'layouts/AppLayout/SecondaryActionBarContext';
import { PanelLeftIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export interface SidebarSplitLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  sidebarPanelId: string;
  mainPanelId?: string;
  minSidebarWidth?: string;
  maxSidebarWidth?: string;
  defaultSidebarWidth?: string;
  collapsedSidebarSize?: string;
  toggleLabel?: string;
}

const DEFAULT_SIDEBAR_WIDTH = '600px';

export function SidebarSplitLayout({
  sidebar,
  children,
  sidebarPanelId,
  mainPanelId,
  minSidebarWidth = DEFAULT_SIDEBAR_WIDTH,
  maxSidebarWidth = '60%',
  defaultSidebarWidth = DEFAULT_SIDEBAR_WIDTH,
  collapsedSidebarSize = '0%',
  toggleLabel = 'Toggle sidebar panel',
}: SidebarSplitLayoutProps) {
  const sidebarPanelRef = usePanelRef();
  const secondaryActionBar = useSecondaryActionBar();
  const [isTogglingSidebar, setIsTogglingSidebar] = useState(false);

  const toggleSidebarPanel = useCallback(() => {
    const sidebarPanel = sidebarPanelRef.current;
    if (!sidebarPanel) return;

    setIsTogglingSidebar(true);
    window.setTimeout(() => setIsTogglingSidebar(false), 220);

    if (sidebarPanel.isCollapsed() || sidebarPanel.getSize().inPixels <= 1) {
      sidebarPanel.resize(defaultSidebarWidth);
      return;
    }

    sidebarPanel.collapse();
  }, [defaultSidebarWidth, sidebarPanelRef]);

  useEffect(() => {
    secondaryActionBar?.setLeadingAction(
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="-ml-1 size-8"
        aria-label={toggleLabel}
        onClick={toggleSidebarPanel}
      >
        <PanelLeftIcon />
      </Button>,
    );

    return () => secondaryActionBar?.setLeadingAction(null);
  }, [secondaryActionBar, toggleLabel, toggleSidebarPanel]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <AppSidebarLayout
        position="inline"
        resizable
        minWidth={minSidebarWidth}
        maxWidth={maxSidebarWidth}
        defaultWidth={defaultSidebarWidth}
        collapsible
        collapsedSize={collapsedSidebarSize}
        sidebarPanelId={sidebarPanelId}
        mainPanelId={mainPanelId}
        sidebarPanelRef={sidebarPanelRef}
        sidebarPanelClassName={
          isTogglingSidebar ? 'transition-[flex-basis,width] duration-200 ease-out' : undefined
        }
        sidebar={sidebar}
      >
        {children}
      </AppSidebarLayout>
    </div>
  );
}
