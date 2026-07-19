import { Button } from 'components/ui/button';
import { PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { TtsPlaybackStatus, TtsPlayerProps, TtsPlayerSection } from './tts-player.types';
import type { KokoroTTS } from 'kokoro-js';

import {
  createTtsSectionsFromText,
  formatTtsTime,
  normalizeTtsText,
  splitTtsSentences,
} from './tts-player.utils';
import styles from './TtsPlayer.module.css';

const KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const DEFAULT_VOICE = 'bm_daniel';
const DEFAULT_SPEED = 1;

let ttsPromise: Promise<KokoroTTS> | null = null;
const progressListeners = new Set<(message: string) => void>();

function formatKokoroProgress(progress: unknown) {
  if (!progress || typeof progress !== 'object') return 'Loading Kokoro model...';
  const data = progress as { file?: string; progress?: number; status?: string };
  const percent = typeof data.progress === 'number' ? ` ${Math.round(data.progress)}%` : '';
  const file = data.file ? ` ${data.file}` : '';
  return `${data.status ?? 'Loading'}${percent}${file}`.trim();
}

function notifyKokoroProgress(progress: unknown) {
  const message = formatKokoroProgress(progress);
  for (const listener of progressListeners) listener(message);
}

async function getTts(onProgress: (message: string) => void) {
  progressListeners.add(onProgress);
  try {
    ttsPromise ??= import('kokoro-js').then(({ KokoroTTS }) =>
      KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: notifyKokoroProgress,
      }),
    );
    return await ttsPromise;
  } finally {
    progressListeners.delete(onProgress);
  }
}

function getPlayableSections(text?: string, sections?: TtsPlayerSection[]) {
  const sourceSections = sections?.length ? sections : text ? createTtsSectionsFromText(text) : [];
  return sourceSections
    .map((section, index) => ({
      id: section.id || `section-${index}`,
      label: section.label,
      text: normalizeTtsText(section.text),
    }))
    .filter((section) => section.text.length > 0);
}

export function TtsPlayer({
  text,
  sections,
  variant = 'full',
  voice = DEFAULT_VOICE,
  speed = DEFAULT_SPEED,
  estimatedDurationSeconds,
  className,
}: TtsPlayerProps) {
  const playableSections = useMemo(() => getPlayableSections(text, sections), [sections, text]);
  const [status, setStatus] = useState<TtsPlaybackStatus>('idle');
  const [sectionIndex, setSectionIndex] = useState(0);
  const [completedAudioSeconds, setCompletedAudioSeconds] = useState(0);
  const [currentAudioSeconds, setCurrentAudioSeconds] = useState(0);
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const playbackRunRef = useRef(0);

  const hasSections = playableSections.length > 0;
  const isFull = variant === 'full';
  const isPlaying = status === 'playing' || status === 'loading';
  const elapsedSeconds = completedAudioSeconds + currentAudioSeconds;
  const remainingSeconds =
    estimatedDurationSeconds != null ? Math.max(0, estimatedDurationSeconds - elapsedSeconds) : null;
  const progress =
    estimatedDurationSeconds && estimatedDurationSeconds > 0
      ? Math.min(100, (elapsedSeconds / estimatedDurationSeconds) * 100)
      : 0;

  useEffect(() => {
    return () => {
      playbackRunRef.current += 1;
      clearCurrentAudio();
      void audioContextRef.current?.close();
    };
  }, []);

  useEffect(() => {
    setStatus('idle');
    setSectionIndex(0);
    setCompletedAudioSeconds(0);
    setCurrentAudioSeconds(0);
    setError('');
    playbackRunRef.current += 1;
    clearCurrentAudio();
  }, [playableSections]);

  function clearProgressTimer() {
    if (progressTimerRef.current != null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }

  function clearCurrentAudio() {
    clearProgressTimer();
    sourceRef.current?.disconnect();
    try {
      sourceRef.current?.stop();
    } catch {
      // Already stopped.
    }
    sourceRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  async function getAudioContext() {
    audioContextRef.current ??= new AudioContext();
    if (audioContextRef.current.state !== 'running') await audioContextRef.current.resume();
    return audioContextRef.current;
  }

  async function playAudioBlob(blob: Blob, runId: number) {
    clearCurrentAudio();
    const context = await getAudioContext();
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    sourceRef.current = source;

    await new Promise<void>((resolve, reject) => {
      const startedAt = context.currentTime;
      progressTimerRef.current = window.setInterval(() => {
        if (playbackRunRef.current === runId && context.state === 'running') {
          setCurrentAudioSeconds(Math.min(buffer.duration, context.currentTime - startedAt));
        }
      }, 200);

      source.addEventListener('ended', () => {
        clearProgressTimer();
        if (playbackRunRef.current === runId) {
          setCompletedAudioSeconds((value) => value + buffer.duration);
          setCurrentAudioSeconds(0);
        }
        resolve();
      });

      try {
        source.start();
      } catch (err) {
        reject(err);
      }
    });
  }

  async function startPlayback(startIndex = sectionIndex) {
    if (!hasSections) return;
    const runId = playbackRunRef.current + 1;
    playbackRunRef.current = runId;
    setStatus('loading');
    setError('');
    setError('Loading Kokoro model...');
    setCurrentAudioSeconds(0);

    try {
      const context = await getAudioContext();
      const { TextSplitterStream } = await import('kokoro-js');
      const tts = await getTts(setError);
      for (let index = startIndex; index < playableSections.length; index += 1) {
        if (playbackRunRef.current !== runId) return;
        setSectionIndex(index);

        const section = playableSections[index];
        if (!section) break;

        setError(`Preparing ${section.label ?? `section ${index + 1}`}...`);
        const splitter = new TextSplitterStream();
        const stream = tts.stream(splitter, { voice, speed });
        for (const sentence of splitTtsSentences(section.text)) splitter.push(`${sentence} `);
        splitter.close();

        for await (const { audio } of stream) {
          if (playbackRunRef.current !== runId) return;
          if (context.state !== 'running') await context.resume();
          setStatus('playing');
          setError('');
          await playAudioBlob(audio.toBlob(), runId);
        }
      }

      if (playbackRunRef.current === runId) {
        setStatus('idle');
        setSectionIndex(0);
        setCompletedAudioSeconds(0);
        setCurrentAudioSeconds(0);
      }
    } catch (err) {
      if (playbackRunRef.current !== runId) return;
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unable to start text-to-speech.');
    }
  }

  function handlePlayPause() {
    if (status === 'loading') {
      playbackRunRef.current += 1;
      clearCurrentAudio();
      setStatus('idle');
      setError('');
      return;
    }

    if (status === 'playing') {
      void audioContextRef.current?.suspend();
      setStatus('paused');
      return;
    }

    if (status === 'paused') {
      void audioContextRef.current?.resume();
      setStatus('playing');
      return;
    }

    void startPlayback(sectionIndex);
  }

  function handleSkip(delta: -1 | 1) {
    const nextIndex = Math.min(Math.max(sectionIndex + delta, 0), playableSections.length - 1);
    if (nextIndex === sectionIndex) return;

    playbackRunRef.current += 1;
    clearCurrentAudio();
    setCompletedAudioSeconds(0);
    setCurrentAudioSeconds(0);
    setSectionIndex(nextIndex);
    void startPlayback(nextIndex);
  }

  return (
    <div className={`${styles.player} ${isFull ? styles.full : styles.compact} ${className ?? ''}`}>
      {isFull ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={styles.controlButton}
          disabled={!hasSections || sectionIndex === 0}
          aria-label="Previous section"
          onClick={() => handleSkip(-1)}
        >
          <SkipBackIcon aria-hidden="true" />
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={styles.controlButton}
        disabled={!hasSections}
        aria-label={isPlaying ? 'Pause text-to-speech' : 'Play text-to-speech'}
        onClick={handlePlayPause}
      >
        {isPlaying ? <PauseIcon aria-hidden="true" /> : <PlayIcon aria-hidden="true" />}
      </Button>
      {isFull ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={styles.controlButton}
            disabled={!hasSections || sectionIndex >= playableSections.length - 1}
            aria-label="Next section"
            onClick={() => handleSkip(1)}
          >
            <SkipForwardIcon aria-hidden="true" />
          </Button>
          <div className={styles.timelineGroup}>
            <span className={styles.time}>{formatTtsTime(elapsedSeconds)}</span>
            <div
              className={styles.timeline}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
            >
              <span
                className={styles.progress}
                style={{ '--tts-progress': `${progress}%` } as React.CSSProperties}
              />
            </div>
            <span className={styles.time}>
              {remainingSeconds != null ? `-${formatTtsTime(remainingSeconds)}` : '--:--'}
            </span>
          </div>
          {status === 'loading' || status === 'error' ? (
            <span className={styles.status}>{status === 'loading' ? 'Preparing audio…' : error}</span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
