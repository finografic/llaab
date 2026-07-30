import { Button } from 'components/ui/button';
import { PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { TtsAudioChunk, TtsSynthesisParams } from './tts-player.engine';
import type {
  TtsDevice,
  TtsDtype,
  TtsPlayerHandle,
  TtsPlaybackStatus,
  TtsPlayerProps,
  TtsPlayerSection,
} from './tts-player.types';

import {
  getCachedTtsAudio,
  resumeSharedTtsAudioContext,
  retainTtsAudio,
  streamTtsAudio,
  suspendSharedTtsAudioContext,
} from './tts-player.engine';
import { createTtsSectionsFromText, formatTtsTime, normalizeTtsText } from './tts-player.utils';
import styles from './TtsPlayer.module.css';

const DEFAULT_VOICE: TtsPlayerProps['voice'] = 'bm_daniel';
const DEFAULT_SPEED = 1.15;
const DEFAULT_SENTENCE_PAUSE_MS = 0;
const DEFAULT_PARAGRAPH_PAUSE_MS = 0;
/** Best quality + speed on Apple Silicon / modern GPUs. */
const DEFAULT_DTYPE: TtsDtype = 'fp32';
const DEFAULT_DEVICE: TtsDevice = 'webgpu';
const TTS_PLAYBACK_CLAIM_EVENT = 'tts-playback-claim';

const ttsPlaybackCoordinator = new EventTarget();
let activeTtsPlayerId: string | null = null;
let nextTtsPlayerId = 0;

interface TtsPlaybackClaimEventDetail {
  playerId: string;
}

function createTtsPlayerId() {
  nextTtsPlayerId += 1;
  return `tts-player-${nextTtsPlayerId}`;
}

function claimTtsPlayback(playerId: string) {
  if (activeTtsPlayerId === playerId) return;

  activeTtsPlayerId = playerId;
  ttsPlaybackCoordinator.dispatchEvent(
    new CustomEvent<TtsPlaybackClaimEventDetail>(TTS_PLAYBACK_CLAIM_EVENT, {
      detail: { playerId },
    }),
  );
}

function releaseTtsPlayback(playerId: string) {
  if (activeTtsPlayerId === playerId) activeTtsPlayerId = null;
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

export const TtsPlayer = forwardRef<TtsPlayerHandle, TtsPlayerProps>(function TtsPlayer(
  {
    text,
    sections,
    variant = 'full',
    voice = DEFAULT_VOICE,
    speed = DEFAULT_SPEED,
    sentencePauseMs = DEFAULT_SENTENCE_PAUSE_MS,
    paragraphPauseMs = DEFAULT_PARAGRAPH_PAUSE_MS,
    estimatedDurationSeconds,
    className,
    dtype = DEFAULT_DTYPE,
    device = DEFAULT_DEVICE,
  },
  ref,
) {
  const playableSections = useMemo(() => getPlayableSections(text, sections), [sections, text]);
  const [status, setStatus] = useState<TtsPlaybackStatus>('idle');
  const [sectionIndex, setSectionIndex] = useState(0);
  const [completedAudioSeconds, setCompletedAudioSeconds] = useState(0);
  const [currentAudioSeconds, setCurrentAudioSeconds] = useState(0);
  const [error, setError] = useState('');
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const playbackRunRef = useRef(0);
  const unsubscribeStreamRef = useRef<() => void>(() => {});
  const playbackQueueRef = useRef<Promise<void>>(Promise.resolve());
  const playerIdRef = useRef(createTtsPlayerId());

  const hasSections = playableSections.length > 0;
  const isFull = variant === 'full';
  const isPlaying = status === 'playing' || status === 'loading';
  const elapsedSeconds = completedAudioSeconds + currentAudioSeconds;
  const safeSentencePauseMs = Math.max(0, sentencePauseMs);
  const safeParagraphPauseMs = Math.max(0, paragraphPauseMs);
  const remainingSeconds =
    estimatedDurationSeconds != null ? Math.max(0, estimatedDurationSeconds - elapsedSeconds) : null;
  const progress =
    estimatedDurationSeconds && estimatedDurationSeconds > 0
      ? Math.min(100, (elapsedSeconds / estimatedDurationSeconds) * 100)
      : 0;

  useEffect(() => {
    const handlePlaybackClaim = (event: Event) => {
      const { detail } = event as CustomEvent<TtsPlaybackClaimEventDetail>;
      if (detail.playerId !== playerIdRef.current) stopPlayback({ releaseClaim: false });
    };

    ttsPlaybackCoordinator.addEventListener(TTS_PLAYBACK_CLAIM_EVENT, handlePlaybackClaim);

    return () => {
      ttsPlaybackCoordinator.removeEventListener(TTS_PLAYBACK_CLAIM_EVENT, handlePlaybackClaim);
      stopPlayback();
    };
  }, []);

  useEffect(() => {
    setStatus('idle');
    setSectionIndex(0);
    setCompletedAudioSeconds(0);
    setCurrentAudioSeconds(0);
    setError('');
    stopPlayback();
  }, [playableSections, voice, speed, dtype, device]);

  useImperativeHandle(ref, () => ({
    preload: async () => {
      if (!hasSections) return;
      await retainTtsAudio(createSynthesisParams(0)).then(
        () => undefined,
        () => undefined,
      );
    },
    playFromStart: () => {
      stopPlayback({ releaseClaim: false });
      setCompletedAudioSeconds(0);
      setCurrentAudioSeconds(0);
      setSectionIndex(0);
      void startPlayback(0);
    },
    stop: () => stopPlayback(),
  }));

  function createSynthesisParams(startIndex: number): TtsSynthesisParams {
    return { sections: playableSections, startIndex, voice, speed, dtype, device };
  }

  function clearProgressTimer() {
    if (progressTimerRef.current != null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }

  function clearCurrentAudio() {
    clearProgressTimer();
    try {
      sourceRef.current?.stop();
    } catch {
      // Already stopped.
    }
    sourceRef.current?.disconnect();
    sourceRef.current = null;
  }

  function stopPlayback({ releaseClaim = true }: { releaseClaim?: boolean } = {}) {
    playbackRunRef.current += 1;
    playbackQueueRef.current = Promise.resolve();
    // Detaches from the shared job; retained preloads keep running for later reuse.
    unsubscribeStreamRef.current();
    unsubscribeStreamRef.current = () => {};
    clearCurrentAudio();
    setStatus('idle');
    setSectionIndex(0);
    setCompletedAudioSeconds(0);
    setError('');
    setCurrentAudioSeconds(0);
    if (releaseClaim) releaseTtsPlayback(playerIdRef.current);
  }

  async function playDecodedBuffer(buffer: AudioBuffer, runId: number) {
    clearCurrentAudio();
    const context = await resumeSharedTtsAudioContext();
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

  async function waitForPause(delayMs: number, runId: number) {
    if (delayMs <= 0 || playbackRunRef.current !== runId) return;
    await new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));
  }

  function getChunkPauseMs(chunk: TtsAudioChunk) {
    return chunk.isLastInSection && chunk.sectionIndex < playableSections.length - 1
      ? safeParagraphPauseMs
      : safeSentencePauseMs;
  }

  async function playCachedChunks(chunks: TtsAudioChunk[], runId: number) {
    for (const chunk of chunks) {
      if (playbackRunRef.current !== runId) return;
      setSectionIndex(chunk.sectionIndex);
      setStatus('playing');
      setError('');
      await playDecodedBuffer(chunk.buffer, runId);
      await waitForPause(getChunkPauseMs(chunk), runId);
    }

    if (playbackRunRef.current !== runId) return;
    finishPlayback(runId);
  }

  function finishPlayback(runId: number) {
    if (playbackRunRef.current !== runId) return;
    setStatus('idle');
    setSectionIndex(0);
    setCompletedAudioSeconds(0);
    setCurrentAudioSeconds(0);
    releaseTtsPlayback(playerIdRef.current);
  }

  async function startPlayback(startIndex = sectionIndex) {
    if (!hasSections) return;
    claimTtsPlayback(playerIdRef.current);
    const runId = playbackRunRef.current + 1;
    playbackRunRef.current = runId;
    setCurrentAudioSeconds(0);
    playbackQueueRef.current = Promise.resolve();
    unsubscribeStreamRef.current();
    unsubscribeStreamRef.current = () => {};

    const params = createSynthesisParams(startIndex);
    const cachedChunks = getCachedTtsAudio(params);

    // Preloaded audio plays without touching the worker at all.
    if (cachedChunks) {
      setStatus('playing');
      setError('');
      await playCachedChunks(cachedChunks, runId);
      return;
    }

    setStatus('loading');
    setError('Loading Kokoro model...');

    try {
      await resumeSharedTtsAudioContext();
    } catch (err) {
      if (playbackRunRef.current !== runId) return;
      releaseTtsPlayback(playerIdRef.current);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unable to start text-to-speech.');
      return;
    }

    if (playbackRunRef.current !== runId) return;

    // Joins an in-flight preload when one exists, so partial work is never re-synthesized.
    unsubscribeStreamRef.current = streamTtsAudio(params, {
      onProgress: (message) => {
        if (playbackRunRef.current === runId) setError(message);
      },
      onSection: (nextSectionIndex) => {
        if (playbackRunRef.current === runId) setSectionIndex(nextSectionIndex);
      },
      onChunk: (chunk) => {
        playbackQueueRef.current = playbackQueueRef.current.then(async () => {
          if (playbackRunRef.current !== runId) return undefined;
          setStatus('playing');
          setError('');
          setSectionIndex(chunk.sectionIndex);
          await playDecodedBuffer(chunk.buffer, runId);
          await waitForPause(getChunkPauseMs(chunk), runId);
          return undefined;
        });
      },
      onDone: () => {
        playbackQueueRef.current = playbackQueueRef.current.then(() => {
          finishPlayback(runId);
          return undefined;
        });
      },
      onError: (err) => {
        if (playbackRunRef.current !== runId) return;
        releaseTtsPlayback(playerIdRef.current);
        setStatus('error');
        setError(err.message);
      },
    });
  }

  function handlePlayPause() {
    if (status === 'loading') {
      stopPlayback();
      return;
    }

    if (status === 'playing') {
      void suspendSharedTtsAudioContext().then(() => {
        if (activeTtsPlayerId === playerIdRef.current) setStatus('paused');
        return undefined;
      });
      return;
    }

    if (status === 'paused') {
      claimTtsPlayback(playerIdRef.current);
      void resumeSharedTtsAudioContext().then(() => {
        if (activeTtsPlayerId === playerIdRef.current) setStatus('playing');
        return undefined;
      });
      return;
    }

    void startPlayback(sectionIndex);
  }

  function handleSkip(delta: -1 | 1) {
    const nextIndex = Math.min(Math.max(sectionIndex + delta, 0), playableSections.length - 1);
    if (nextIndex === sectionIndex) return;

    stopPlayback({ releaseClaim: false });
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
            {estimatedDurationSeconds ? (
              <span className={styles.time}>
                {remainingSeconds != null ? `-${formatTtsTime(remainingSeconds)}` : '--:--'}
              </span>
            ) : null}
          </div>
          {estimatedDurationSeconds && (status === 'loading' || status === 'error') ? (
            <span className={styles.status}>
              {status === 'loading' ? error || 'Preparing audio…' : error}
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );
});
