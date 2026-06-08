import { useQuery } from '@tanstack/react-query';

import { api } from 'lib/api';

import { QUERY_KEYS } from './index';

export interface TranscriptIdea {
  id: string;
  title: string;
}

export async function fetchExistingIdeas(transcriptId: string): Promise<TranscriptIdea[]> {
  const res = await api.vault.transcripts[':id'].ideas.$get({ param: { id: transcriptId } });
  const json = (await res.json()) as { ideas?: TranscriptIdea[] };
  return json.ideas ?? [];
}

/** Ideas already extracted from a transcript. Disabled until `transcriptId` is known. */
export function useTranscriptIdeas(transcriptId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.transcripts.ideas(transcriptId ?? ''),
    queryFn: () => fetchExistingIdeas(transcriptId as string),
    enabled: transcriptId != null,
  });
}
