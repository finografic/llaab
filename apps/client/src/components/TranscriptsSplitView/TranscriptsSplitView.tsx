import { useAppLeftSidebar } from 'layouts/AppLayout/AppLeftSidebarContext';
import { useMemo } from 'react';
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
  wikiCountsByTranscriptId?: ReadonlyMap<string, number>;
}

const EMPTY_IDEAS: IdeaNode[] = [];
const EMPTY_CANONICAL_IDEAS: CanonicalIdeaNode[] = [];
const EMPTY_EXTRACTION_RUNS: TranscriptExtractionRun[] = [];
const EMPTY_WIKI_COUNTS = new Map<string, number>();
const TRANSCRIPTS_SIDEBAR_ID = 'vault-transcripts';
const TRANSCRIPTS_SIDEBAR_WIDTH = '500px';

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

function renderSidebar(
  transcripts: TranscriptNode[],
  selectedId: string | undefined,
  wikiCountsByTranscriptId: ReadonlyMap<string, number>,
) {
  return (
    <TranscriptsSidebar
      transcripts={transcripts}
      selectedId={selectedId}
      wikiCountsByTranscriptId={wikiCountsByTranscriptId}
    />
  );
}

export function TranscriptsSplitView({
  transcripts,
  selectedId,
  transcript,
  extractedIdeas,
  canonicalIdeas = EMPTY_CANONICAL_IDEAS,
  extractionRuns = EMPTY_EXTRACTION_RUNS,
  wikiCountsByTranscriptId = EMPTY_WIKI_COUNTS,
}: TranscriptsSplitViewProps) {
  const ideas = extractedIdeas ?? EMPTY_IDEAS;
  const sidebarContent = useMemo(
    () => renderSidebar(transcripts, selectedId, wikiCountsByTranscriptId),
    [selectedId, transcripts, wikiCountsByTranscriptId],
  );

  const leftSidebar = useMemo(
    () => ({
      id: TRANSCRIPTS_SIDEBAR_ID,
      content: sidebarContent,
      defaultOpen: true,
      minWidth: TRANSCRIPTS_SIDEBAR_WIDTH,
      maxWidth: TRANSCRIPTS_SIDEBAR_WIDTH,
      defaultWidth: TRANSCRIPTS_SIDEBAR_WIDTH,
    }),
    [sidebarContent],
  );

  useAppLeftSidebar(leftSidebar);

  return renderDetail(transcript, ideas, canonicalIdeas, extractionRuns);
}
