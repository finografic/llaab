import { TranscriptsSplitView } from 'components/TranscriptsSplitView/TranscriptsSplitView';
import { useVaultNodes } from 'queries/vault';
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TranscriptNode } from '@llaab/schemas';

import { usePageTitle } from 'lib/use-page-title';

export function TranscriptsPage() {
  usePageTitle('Transcripts');

  const { data: all = [], isLoading } = useVaultNodes({ type: 'transcript' });
  const transcripts = useMemo(
    () => [...(all as TranscriptNode[])].toSorted((a, b) => b.created_at.localeCompare(a.created_at)),
    [all],
  );
  const latestTranscriptId = transcripts[0]?.id;
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (!latestTranscriptId) return;

    navigate(`/vault/transcripts/${latestTranscriptId}`, { replace: true });
  }, [isLoading, latestTranscriptId, navigate]);

  if (isLoading) {
    return <p className="text-muted-foreground p-6 text-sm">Loading transcripts…</p>;
  }

  return <TranscriptsSplitView transcripts={transcripts} />;
}
