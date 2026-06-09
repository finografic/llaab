import { AppSidebarLayout } from 'components/ui/app-sidebar-layout';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from 'components/ui/breadcrumb';
import { Separator } from 'components/ui/separator';
import { SidebarTrigger } from 'components/ui/sidebar';
import { TooltipProvider } from 'components/ui/tooltip';
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

export function TranscriptsSplitView({
  transcripts,
  selectedId,
  transcript,
  extractedIdeas,
}: TranscriptsSplitViewProps) {
  const ideas = extractedIdeas ?? EMPTY_IDEAS;

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
          header={
            <>
              <SidebarTrigger className="-ml-1" />
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
