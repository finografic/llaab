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

export function classifyUrl(value: string): SourceKind {
  if (!isHttpUrl(value)) return 'unknown';
  return isYouTubeUrl(value) ? 'youtube' : 'webpage';
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

export function stepLabel(transcriptPhase: TranscriptPhase, extractionPhase: ExtractionPhase): string {
  if (transcriptPhase === 'processing') return 'Fetching transcript…';
  if (transcriptPhase === 'failed') return 'Transcript fetch failed';
  if (extractionPhase === 'waiting') return 'Waiting for extraction';
  if (extractionPhase === 'pending') return 'Extracting ideas…';
  if (extractionPhase === 'success' || extractionPhase === 'existing') return 'Complete';
  if (extractionPhase === 'extractable') return 'No ideas extracted';
  if (extractionPhase === 'failed') return 'Extraction failed';
  if (transcriptPhase === 'saved') return 'Transcript saved';
  if (transcriptPhase === 'reused') return 'Transcript already saved';
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

export function transcriptStepTitle(phase: TranscriptPhase): string {
  if (phase === 'saved') return 'Transcript saved';
  if (phase === 'reused') return 'Transcript already saved';
  if (phase === 'failed') return 'Transcript failed';
  if (phase === 'processing') return 'Transcript processing';
  return 'Transcript pending';
}

export function extractionStepTitle(phase: ExtractionPhase): string {
  if (phase === 'pending') return 'Extraction processing';
  if (phase === 'success' || phase === 'existing') return 'Ideas extracted';
  if (phase === 'extractable') return 'No ideas extracted yet';
  if (phase === 'failed') return 'Extraction failed';
  if (phase === 'waiting') return 'Extraction pending';
  return 'Extraction pending';
}
