export interface FormValues {
  url: string;
}

export type SourceKind = 'youtube' | 'webpage' | 'unknown';
export type TranscriptPhase = 'idle' | 'processing' | 'saved' | 'reused' | 'failed';
export type ExtractionPhase =
  | 'idle'
  | 'waiting'
  | 'pending'
  | 'success'
  | 'existing'
  | 'extractable'
  | 'failed';

export interface TranscriptData {
  id: string;
  filename: string;
}

export interface QueuedIngestItem {
  id: string;
  url: string;
  tags: string[];
}
