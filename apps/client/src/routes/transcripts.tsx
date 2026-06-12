import { TranscriptsSplitView } from 'components/TranscriptsSplitView/TranscriptsSplitView';
import { useVaultNodes } from 'queries/vault';
import type { TranscriptNode } from '@llaab/schemas';

import { usePageTitle } from 'lib/use-page-title';

export function TranscriptsPage() {
  usePageTitle('Transcripts');

  const { data: all = [], isLoading } = useVaultNodes({ type: 'transcript' });
  const transcripts = [...(all as TranscriptNode[])].toSorted((a, b) => b.created_at.localeCompare(a.created_at));

  if (isLoading) {
    return <p className="text-muted-foreground p-6 text-sm">Loading transcripts…</p>;
  }

  return <TranscriptsSplitView transcripts={transcripts} />;
}
