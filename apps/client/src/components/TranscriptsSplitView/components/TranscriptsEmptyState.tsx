import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from 'components/ui/empty';
import { FileText } from 'lucide-react';

export function TranscriptsEmptyState() {
  return (
    <Empty className="h-full min-h-[24rem] border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileText />
        </EmptyMedia>
        <EmptyTitle>Select a transcript</EmptyTitle>
        <EmptyDescription>
          Choose a transcript from the list to view its source metadata, summary, extracted ideas, and full
          body.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
