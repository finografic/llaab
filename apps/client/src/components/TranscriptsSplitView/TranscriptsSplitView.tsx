import { SidebarSplitLayout } from 'components/SidebarSplitLayout/SidebarSplitLayout';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from 'components/ui/breadcrumb';
import { Link } from 'react-router-dom';
import type { TranscriptExtractionRun } from './components/TranscriptDetail';
import type { IdeaNode, TranscriptNode } from '@llaab/schemas';

import { TranscriptDetail } from './components/TranscriptDetail';
import { TranscriptsEmptyState } from './components/TranscriptsEmptyState';
import { TranscriptsSidebar } from './components/TranscriptsSidebar';

export interface TranscriptsSplitViewProps {
  transcripts: TranscriptNode[];
  selectedId?: string;
  transcript?: TranscriptNode;
  extractedIdeas?: IdeaNode[];
  extractionRuns?: TranscriptExtractionRun[];
}

const EMPTY_IDEAS: IdeaNode[] = [];
const EMPTY_EXTRACTION_RUNS: TranscriptExtractionRun[] = [];
const SIDEBAR_PANEL_ID = 'transcripts-sidebar';

function renderHeader(transcript?: TranscriptNode) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden md:block">
          <BreadcrumbLink asChild>
            <Link to="/vault/transcripts">Vault</Link>
          </BreadcrumbLink>
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
  );
}

function renderDetail(
  transcript: TranscriptNode | undefined,
  ideas: IdeaNode[],
  extractionRuns: TranscriptExtractionRun[],
) {
  if (!transcript) {
    return <TranscriptsEmptyState />;
  }

  return <TranscriptDetail transcript={transcript} extractedIdeas={ideas} extractionRuns={extractionRuns} />;
}

function renderSidebar(transcripts: TranscriptNode[], selectedId?: string) {
  return <TranscriptsSidebar transcripts={transcripts} selectedId={selectedId} />;
}

export function TranscriptsSplitView({
  transcripts,
  selectedId,
  transcript,
  extractedIdeas,
  extractionRuns = EMPTY_EXTRACTION_RUNS,
}: TranscriptsSplitViewProps) {
  const ideas = extractedIdeas ?? EMPTY_IDEAS;

  return (
    <SidebarSplitLayout
      sidebarPanelId={SIDEBAR_PANEL_ID}
      toggleLabel="Toggle transcripts panel"
      minSidebarWidth="500px"
      maxSidebarWidth="500px"
      defaultSidebarWidth="500px"
      header={renderHeader(transcript)}
      sidebar={renderSidebar(transcripts, selectedId)}
    >
      {renderDetail(transcript, ideas, extractionRuns)}
    </SidebarSplitLayout>
  );
}
