export const QUERY_KEYS = {
  transcripts: {
    all: ['transcripts'] as const,
    ideas: (id: string) => [...QUERY_KEYS.transcripts.all, 'ideas', id] as const,
  },
};

export { useTranscriptIdeas, fetchExistingIdeas } from './useTranscriptIdeas';
export { useConsolidateCanonicalIdeas } from './useConsolidateCanonicalIdeas';
export { useExtractTranscript } from './useExtractTranscript';
export { useDiscardTranscript } from './useDiscardTranscript';
export { useIngestYoutube } from './useIngestYoutube';
export { useIngestPodcast } from './useIngestPodcast';
export { usePromoteCanonicalIdea } from './usePromoteCanonicalIdea';
export { useResolveCanonicalIdeaConflict } from './useResolveCanonicalIdeaConflict';
export { useCleanCanonicalIdeaArtifacts } from './useCleanCanonicalIdeaArtifacts';
export { useCreateWikiDraft } from './useCreateWikiDraft';
export type { TranscriptIdea } from './useTranscriptIdeas';
export type { ConsolidateCanonicalIdeasResult } from './useConsolidateCanonicalIdeas';
export type { ExtractTranscriptResult } from './useExtractTranscript';
export type { IngestYoutubeInput, IngestYoutubeResult } from './useIngestYoutube';
export type { IngestPodcastInput, IngestPodcastResult } from './useIngestPodcast';
export type { PromoteCanonicalIdeaResult } from './usePromoteCanonicalIdea';
export type { ResolveCanonicalIdeaConflictResult } from './useResolveCanonicalIdeaConflict';
export type { CleanCanonicalIdeaArtifactsResult } from './useCleanCanonicalIdeaArtifacts';
export type { CreateWikiDraftInput, CreateWikiDraftResult } from './useCreateWikiDraft';
