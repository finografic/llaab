import { AppSidebarLayout } from 'components/ui/app-sidebar-layout';
import { Button } from 'components/ui/button';
import { usePanelRef } from 'components/ui/resizable';
import { Separator } from 'components/ui/separator';
import { TooltipProvider } from 'components/ui/tooltip';
import { PanelLeftIcon } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

export interface SidebarSplitLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  header?: ReactNode;
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
  header,
  sidebarPanelId,
  mainPanelId,
  minSidebarWidth = DEFAULT_SIDEBAR_WIDTH,
  maxSidebarWidth = '60%',
  defaultSidebarWidth = DEFAULT_SIDEBAR_WIDTH,
  collapsedSidebarSize = '0%',
  toggleLabel = 'Toggle sidebar panel',
}: SidebarSplitLayoutProps) {
  const sidebarPanelRef = usePanelRef();
  const [isTogglingSidebar, setIsTogglingSidebar] = useState(false);

  function toggleSidebarPanel() {
    const sidebarPanel = sidebarPanelRef.current;
    if (!sidebarPanel) return;

    setIsTogglingSidebar(true);
    window.setTimeout(() => setIsTogglingSidebar(false), 220);

    if (sidebarPanel.isCollapsed() || sidebarPanel.getSize().inPixels <= 1) {
      sidebarPanel.resize(defaultSidebarWidth);
      return;
    }

    sidebarPanel.collapse();
  }

  return (
    <TooltipProvider>
      <div className="flex h-(--content-area-h) min-h-0 flex-col overflow-hidden">
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
          header={
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="-ml-1 size-8"
                aria-label={toggleLabel}
                onClick={toggleSidebarPanel}
              >
                <PanelLeftIcon />
              </Button>
              {header ? (
                <>
                  <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
                  {header}
                </>
              ) : null}
            </>
          }
          sidebar={sidebar}
        >
          {children}
        </AppSidebarLayout>
      </div>
    </TooltipProvider>
  );
}
