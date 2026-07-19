import type { GenerateOptions } from 'kokoro-js';

export interface TtsPlayerSection {
  id: string;
  label?: string;
  text: string;
}

export type TtsPlayerVariant = 'compact' | 'full' | 'minimal';

/** Kokoro model weight precision — lower is faster / lower fidelity. */
export type TtsDtype = 'fp32' | 'fp16' | 'q8' | 'q4' | 'q4f16';

/** Kokoro inference backend. Prefer `webgpu` + `fp32` when available. */
export type TtsDevice = 'wasm' | 'webgpu' | 'cpu';

export interface TtsPlayerProps {
  text?: string;
  sections?: TtsPlayerSection[];
  variant?: TtsPlayerVariant;
  voice?: GenerateOptions['voice'];
  speed?: number;
  sentencePauseMs?: number;
  paragraphPauseMs?: number;
  estimatedDurationSeconds?: number;
  className?: string;
  /** Model precision. Default `fp32` (best quality with `webgpu`). */
  dtype?: TtsDtype;
  /** Inference device. Default `webgpu`. */
  device?: TtsDevice;
}

export type TtsPlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';
