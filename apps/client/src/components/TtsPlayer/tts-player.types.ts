import type { GenerateOptions } from 'kokoro-js';

export interface TtsPlayerSection {
  id: string;
  label?: string;
  text: string;
}

export type TtsPlayerVariant = 'compact' | 'full';

export interface TtsPlayerProps {
  text?: string;
  sections?: TtsPlayerSection[];
  variant?: TtsPlayerVariant;
  voice?: GenerateOptions['voice'];
  speed?: number;
  estimatedDurationSeconds?: number;
  className?: string;
}

export type TtsPlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';
