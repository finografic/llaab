export const QUERY_KEYS = {
  transcripts: {
    all: ['transcripts'] as const,
    ideas: (id: string) => [...QUERY_KEYS.transcripts.all, 'ideas', id] as const,
  },
};

export { useTranscriptIdeas, fetchExistingIdeas } from './useTranscriptIdeas';
export { useExtractTranscript } from './useExtractTranscript';
export { useDiscardTranscript } from './useDiscardTranscript';
export { useIngestYoutube } from './useIngestYoutube';
export type { TranscriptIdea } from './useTranscriptIdeas';
export type { ExtractTranscriptResult } from './useExtractTranscript';
export type { IngestYoutubeInput, IngestYoutubeResult } from './useIngestYoutube';
