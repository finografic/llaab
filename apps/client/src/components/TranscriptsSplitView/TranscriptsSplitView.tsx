import { AppSidebarLayout } from 'components/ui/app-sidebar-layout';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from 'components/ui/breadcrumb';
import { Button } from 'components/ui/button';
import { usePanelRef } from 'components/ui/resizable';
import { Separator } from 'components/ui/separator';
import { TooltipProvider } from 'components/ui/tooltip';
import { PanelLeftIcon } from 'lucide-react';
import { useState } from 'react';
import type { IdeaNode, TranscriptNode } from '@llaab/schemas';

import { TranscriptDetail } from './components/TranscriptDetail';
import { TranscriptsEmptyState } from './components/TranscriptsEmptyState';
import { TranscriptsSidebar } from './components/TranscriptsSidebar';

export interface TranscriptsSplitViewProps {
  transcripts: TranscriptNode[];
  selectedId?: string;
  transcript?: TranscriptNode;
  extractedIdeas?: IdeaNode[];
}

const EMPTY_IDEAS: IdeaNode[] = [];
const SIDEBAR_PANEL_ID = 'transcripts-sidebar';
const SIDEBAR_DEFAULT_WIDTH = '600px';

export function TranscriptsSplitView({
  transcripts,
  selectedId,
  transcript,
  extractedIdeas,
}: TranscriptsSplitViewProps) {
  const ideas = extractedIdeas ?? EMPTY_IDEAS;
  const sidebarPanelRef = usePanelRef();
  const [isTogglingSidebar, setIsTogglingSidebar] = useState(false);

  function toggleSidebarPanel() {
    const sidebarPanel = sidebarPanelRef.current;
    if (!sidebarPanel) return;

    setIsTogglingSidebar(true);
    window.setTimeout(() => setIsTogglingSidebar(false), 220);

    if (sidebarPanel.isCollapsed() || sidebarPanel.getSize().inPixels <= 1) {
      sidebarPanel.resize(SIDEBAR_DEFAULT_WIDTH);
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
          minWidth="600px"
          maxWidth="60%"
          defaultWidth="600px"
          collapsible
          collapsedSize="0%"
          sidebarPanelId={SIDEBAR_PANEL_ID}
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
                aria-label="Toggle transcripts panel"
                onClick={toggleSidebarPanel}
              >
                <PanelLeftIcon />
              </Button>
              <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/vault/transcripts">Vault</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    {transcript ? (
                      <BreadcrumbPage className="max-w-[40ch] truncate">{transcript.title}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbPage>Transcripts</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </>
          }
          sidebar={<TranscriptsSidebar transcripts={transcripts} selectedId={selectedId} />}
        >
          {transcript ? (
            <TranscriptDetail transcript={transcript} extractedIdeas={ideas} />
          ) : (
            <TranscriptsEmptyState />
          )}
        </AppSidebarLayout>
      </div>
    </TooltipProvider>
  );
}
