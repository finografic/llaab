import { SidebarSplitLayout } from 'components/SidebarSplitLayout/SidebarSplitLayout';
import type { TranscriptExtractionRun } from './components/TranscriptDetail';
import type { CanonicalIdeaNode, IdeaNode, TranscriptNode } from '@llaab/schemas';

import { TranscriptDetail } from './components/TranscriptDetail';
import { TranscriptsEmptyState } from './components/TranscriptsEmptyState';
import { TranscriptsSidebar } from './components/TranscriptsSidebar';

export interface TranscriptsSplitViewProps {
  transcripts: TranscriptNode[];
  selectedId?: string;
  transcript?: TranscriptNode;
  extractedIdeas?: IdeaNode[];
  canonicalIdeas?: CanonicalIdeaNode[];
  extractionRuns?: TranscriptExtractionRun[];
}

const EMPTY_IDEAS: IdeaNode[] = [];
const EMPTY_EXTRACTION_RUNS: TranscriptExtractionRun[] = [];
const SIDEBAR_PANEL_ID = 'transcripts-sidebar';

function renderDetail(
  transcript: TranscriptNode | undefined,
  ideas: IdeaNode[],
  canonicalIdeas: CanonicalIdeaNode[],
  extractionRuns: TranscriptExtractionRun[],
) {
  if (!transcript) {
    return <TranscriptsEmptyState />;
  }

  return (
    <TranscriptDetail
      // Force a remount per transcript so consolidate-mutation state (isPending, conflict dialog,
      // elapsed timer) doesn't leak from a previously-viewed transcript onto this one — React
      // Router doesn't remount this component just because the route param changed.
      key={transcript.id}
      transcript={transcript}
      extractedIdeas={ideas}
      canonicalIdeas={canonicalIdeas}
      extractionRuns={extractionRuns}
    />
  );
}

function renderSidebar(transcripts: TranscriptNode[], selectedId?: string) {
  return <TranscriptsSidebar transcripts={transcripts} selectedId={selectedId} />;
}

export function TranscriptsSplitView({
  transcripts,
  selectedId,
  transcript,
  extractedIdeas,
  canonicalIdeas = [],
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
      sidebar={renderSidebar(transcripts, selectedId)}
    >
      {renderDetail(transcript, ideas, canonicalIdeas, extractionRuns)}
    </SidebarSplitLayout>
  );
}
