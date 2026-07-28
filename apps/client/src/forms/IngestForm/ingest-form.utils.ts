import type { ExtractionPhase, SourceKind, TranscriptPhase } from './ingest-form.types';

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isYouTubeUrl(value: string): boolean {
  if (!isHttpUrl(value)) return false;
  const { hostname } = new URL(value);
  return hostname.replace(/^www\./, '').toLowerCase() === 'youtube.com' || hostname === 'youtu.be';
}

const PODCAST_HOSTNAMES = new Set(['pca.st', 'pocketcasts.com', 'www.pocketcasts.com']);

export function isPodcastUrl(value: string): boolean {
  if (!isHttpUrl(value)) return false;
  const { hostname } = new URL(value);
  return PODCAST_HOSTNAMES.has(hostname.toLowerCase());
}

export function classifyUrl(value: string): SourceKind {
  if (!isHttpUrl(value)) return 'unknown';
  if (isYouTubeUrl(value)) return 'youtube';
  if (isPodcastUrl(value)) return 'podcast';
  return 'webpage';
}

/** Source kinds the ingest backend actually accepts today. */
export function isIngestibleSourceKind(kind: SourceKind): kind is 'youtube' | 'podcast' | 'webpage' {
  return kind === 'youtube' || kind === 'podcast' || kind === 'webpage';
}

/** Articles land as resource nodes; YouTube and podcasts land as transcripts. */
export function producesTranscript(kind: SourceKind): boolean {
  return kind === 'youtube' || kind === 'podcast';
}

/** Noun for the primary node this source kind produces, used in shared pipeline copy. */
export function contentNoun(kind: SourceKind): string {
  return kind === 'webpage' ? 'Article' : 'Transcript';
}

export function sourceKindLabel(kind: SourceKind): string {
  if (kind === 'youtube') return 'YouTube video URL detected.';
  if (kind === 'podcast') return 'Pocket Casts episode detected.';
  if (kind === 'webpage') return 'Article or web page detected.';
  return 'The form classifies the source asset and adapts the ingest action.';
}

export function ingestButtonLabel(kind: SourceKind): string {
  if (kind === 'youtube') return 'Ingest YouTube';
  if (kind === 'podcast') return 'Ingest Podcast';
  if (kind === 'webpage') return 'Ingest Article';
  return 'Ingest';
}

export function extractDroppedUrl(dataTransfer: DataTransfer): string | null {
  const uriList = dataTransfer.getData('text/uri-list');
  if (uriList) {
    const firstUri = uriList
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0 && !line.startsWith('#'));
    if (firstUri) return firstUri;
  }

  const plainText = dataTransfer.getData('text/plain').trim();
  if (plainText && isHttpUrl(plainText)) return plainText;

  const downloadUrl = dataTransfer.getData('DownloadURL');
  if (downloadUrl) {
    const maybeUrl = downloadUrl.split(':').at(-1)?.trim() ?? '';
    if (isHttpUrl(maybeUrl)) return maybeUrl;
  }

  return null;
}

export function stepLabel(
  transcriptPhase: TranscriptPhase,
  extractionPhase: ExtractionPhase,
  noun = 'Transcript',
): string {
  if (transcriptPhase === 'processing') return `Fetching ${noun.toLowerCase()}…`;
  if (transcriptPhase === 'failed') return `${noun} fetch failed`;
  if (extractionPhase === 'waiting') return 'Waiting for extraction';
  if (extractionPhase === 'pending') return 'Extracting ideas…';
  if (extractionPhase === 'success' || extractionPhase === 'existing') return 'Complete';
  if (extractionPhase === 'extractable') return 'No ideas extracted';
  if (extractionPhase === 'failed') return 'Extraction failed';
  if (transcriptPhase === 'saved') return `${noun} saved`;
  if (transcriptPhase === 'reused') return `${noun} already saved`;
  return 'Starting…';
}

export function runPhase(
  transcriptPhase: TranscriptPhase,
  extractionPhase: ExtractionPhase,
  busy: boolean,
): 'active' | 'success' | 'warning' | 'neutral' {
  if (busy || transcriptPhase === 'idle') return busy ? 'active' : 'neutral';
  const transcriptDone = ['saved', 'reused', 'failed'].includes(transcriptPhase);
  const extractionDone = ['success', 'existing', 'extractable', 'failed'].includes(extractionPhase);
  if (!transcriptDone || !extractionDone) return 'active';
  if (transcriptPhase === 'failed' || extractionPhase === 'failed') return 'warning';
  return 'success';
}

export function transcriptStepTitle(phase: TranscriptPhase, noun = 'Transcript'): string {
  if (phase === 'saved') return `${noun} saved`;
  if (phase === 'reused') return `${noun} already saved`;
  if (phase === 'failed') return `${noun} failed`;
  if (phase === 'processing') return `${noun} processing`;
  return `${noun} pending`;
}

export function extractionStepTitle(phase: ExtractionPhase): string {
  if (phase === 'pending') return 'Extraction processing';
  if (phase === 'success' || phase === 'existing') return 'Ideas extracted';
  if (phase === 'extractable') return 'No ideas extracted yet';
  if (phase === 'failed') return 'Extraction failed';
  if (phase === 'waiting') return 'Extraction pending';
  return 'Extraction pending';
}
