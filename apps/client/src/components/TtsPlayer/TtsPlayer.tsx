import { Button } from 'components/ui/button';
import { PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type {
  TtsDevice,
  TtsDtype,
  TtsPlayerHandle,
  TtsPlaybackStatus,
  TtsPlayerProps,
  TtsPlayerSection,
} from './tts-player.types';

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

interface CachedAudioChunk {
  order: number;
  sectionIndex: number;
  isLastInSection: boolean;
  buffer: AudioBuffer;
}

interface AudioCacheEntry {
  chunks?: CachedAudioChunk[];
  promise?: Promise<CachedAudioChunk[]>;
}

const ttsAudioCache = new Map<string, AudioCacheEntry>();

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

type TtsWorkerMessage =
  | { type: 'progress'; runId: number; message: string }
  | { type: 'section'; runId: number; sectionIndex: number }
  | {
      type: 'audio';
      runId: number;
      sectionIndex: number;
      isLastInSection: boolean;
      buffer: ArrayBuffer;
    }
  | { type: 'done'; runId: number }
  | { type: 'error'; runId: number; message: string };

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
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const playbackRunRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  const workerMessageCleanupRef = useRef<() => void>(() => {});
  const preloadWorkerRef = useRef<Worker | null>(null);
  const preloadMessageCleanupRef = useRef<() => void>(() => {});
  const preloadRejectRef = useRef<((reason?: unknown) => void) | null>(null);
  const preloadRunRef = useRef(0);
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
      clearPreload();
      stopPlayback();
      void audioContextRef.current?.close();
    };
  }, []);

  useEffect(() => {
    clearPreload();
    setStatus('idle');
    setSectionIndex(0);
    setCompletedAudioSeconds(0);
    setCurrentAudioSeconds(0);
    setError('');
    stopPlayback();
  }, [playableSections, voice, speed, dtype, device]);

  useImperativeHandle(ref, () => ({
    preload: async () => {
      await preloadAudio().then(
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

  function getWorker() {
    workerRef.current ??= new Worker(new URL('./tts-player.worker.ts', import.meta.url), {
      type: 'module',
    });
    return workerRef.current;
  }

  function getPreloadWorker() {
    preloadWorkerRef.current ??= new Worker(new URL('./tts-player.worker.ts', import.meta.url), {
      type: 'module',
    });
    return preloadWorkerRef.current;
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
    const runId = playbackRunRef.current;
    playbackRunRef.current += 1;
    playbackQueueRef.current = Promise.resolve();
    workerMessageCleanupRef.current();
    workerRef.current?.postMessage({ type: 'cancel', runId }, { transfer: [] });
    workerRef.current?.terminate();
    workerRef.current = null;
    clearCurrentAudio();
    void audioContextRef.current?.suspend();
    setStatus('idle');
    setSectionIndex(0);
    setCompletedAudioSeconds(0);
    setError('');
    setCurrentAudioSeconds(0);
    if (releaseClaim) releaseTtsPlayback(playerIdRef.current);
  }

  function clearPreload() {
    preloadRunRef.current += 1;
    preloadMessageCleanupRef.current();
    preloadMessageCleanupRef.current = () => {};
    preloadRejectRef.current?.(new Error('Text-to-speech preload cancelled.'));
    preloadRejectRef.current = null;
    preloadWorkerRef.current?.terminate();
    preloadWorkerRef.current = null;
  }

  function createAudioCacheKey(startIndex: number) {
    return JSON.stringify({
      sections: playableSections.slice(startIndex).map((section) => ({
        id: section.id,
        text: section.text,
      })),
      voice,
      speed,
      dtype,
      device,
    });
  }

  async function getAudioContext() {
    audioContextRef.current ??= new AudioContext();
    if (audioContextRef.current.state !== 'running') await audioContextRef.current.resume();
    return audioContextRef.current;
  }

  function getDecodingAudioContext() {
    audioContextRef.current ??= new AudioContext();
    return audioContextRef.current;
  }

  async function playDecodedBuffer(buffer: AudioBuffer, runId: number) {
    clearCurrentAudio();
    const context = await getAudioContext();
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

  async function preloadAudio(startIndex = 0) {
    if (!hasSections) return [];

    const cacheKey = createAudioCacheKey(startIndex);
    const cache = ttsAudioCache.get(cacheKey);
    if (cache?.chunks) return cache.chunks;
    if (cache?.promise) return await cache.promise;

    clearPreload();
    const runId = preloadRunRef.current + 1;
    preloadRunRef.current = runId;
    const chunks: CachedAudioChunk[] = [];
    const decodePromises: Array<Promise<void>> = [];
    let nextChunkOrder = 0;

    const promise = new Promise<CachedAudioChunk[]>((resolve, reject) => {
      preloadRejectRef.current = reject;
      const worker = getPreloadWorker();

      const handleWorkerMessage = (event: MessageEvent<TtsWorkerMessage>) => {
        const message = event.data;
        if (message.runId !== preloadRunRef.current) return;

        if (message.type === 'audio') {
          const order = nextChunkOrder;
          nextChunkOrder += 1;
          const decodePromise = getDecodingAudioContext()
            .decodeAudioData(message.buffer.slice(0))
            .then((buffer) => {
              if (message.runId !== preloadRunRef.current) return;
              chunks.push({
                order,
                sectionIndex: message.sectionIndex,
                isLastInSection: message.isLastInSection,
                buffer,
              });
            })
            .catch(reject);
          decodePromises.push(decodePromise);
          return;
        }

        if (message.type === 'done') {
          void Promise.all(decodePromises).then(() => {
            preloadMessageCleanupRef.current();
            preloadMessageCleanupRef.current = () => {};
            preloadRejectRef.current = null;
            preloadWorkerRef.current?.terminate();
            preloadWorkerRef.current = null;
            const sortedChunks = chunks.toSorted((a, b) => a.order - b.order);
            ttsAudioCache.set(cacheKey, { chunks: sortedChunks });
            resolve(sortedChunks);
          }, reject);
          return;
        }

        if (message.type === 'error') {
          preloadMessageCleanupRef.current();
          preloadMessageCleanupRef.current = () => {};
          preloadRejectRef.current = null;
          ttsAudioCache.delete(cacheKey);
          reject(new Error(message.message));
        }
      };

      worker.addEventListener('message', handleWorkerMessage);
      preloadMessageCleanupRef.current = () => worker.removeEventListener('message', handleWorkerMessage);

      worker.postMessage(
        {
          type: 'start',
          runId,
          sections: playableSections,
          startIndex,
          voice,
          speed,
          dtype,
          device,
        },
        { transfer: [] },
      );
    });

    ttsAudioCache.set(cacheKey, { promise });

    return await promise.catch((err) => {
      if (ttsAudioCache.get(cacheKey)?.promise === promise) ttsAudioCache.delete(cacheKey);
      throw err;
    });
  }

  async function playCachedChunks(chunks: CachedAudioChunk[], runId: number) {
    for (const chunk of chunks) {
      if (playbackRunRef.current !== runId) return;
      setSectionIndex(chunk.sectionIndex);
      setStatus('playing');
      setError('');
      await playDecodedBuffer(chunk.buffer, runId);
      const pauseMs =
        chunk.isLastInSection && chunk.sectionIndex < playableSections.length - 1
          ? safeParagraphPauseMs
          : safeSentencePauseMs;
      await waitForPause(pauseMs, runId);
    }

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
    setStatus('loading');
    setError('Loading Kokoro model...');
    setCurrentAudioSeconds(0);
    playbackQueueRef.current = Promise.resolve();

    try {
      await getAudioContext();
      const cacheKey = createAudioCacheKey(startIndex);
      const cache = ttsAudioCache.get(cacheKey);

      if (cache?.chunks || cache?.promise) {
        const chunks = cache.chunks ?? (await cache.promise);
        if (playbackRunRef.current !== runId) return;
        await playCachedChunks(chunks, runId);
        return;
      }

      const worker = getWorker();

      workerMessageCleanupRef.current();
      const handleWorkerMessage = (event: MessageEvent<TtsWorkerMessage>) => {
        const message = event.data;
        if (message.runId !== playbackRunRef.current) return;

        if (message.type === 'progress') {
          setError(message.message);
          return;
        }

        if (message.type === 'section') {
          setSectionIndex(message.sectionIndex);
          return;
        }

        if (message.type === 'audio') {
          // Decode immediately so the next buffer is ready while the current one plays.
          const decodePromise = getAudioContext().then((context) =>
            context.decodeAudioData(message.buffer.slice(0)),
          );

          playbackQueueRef.current = playbackQueueRef.current.then(async () => {
            if (message.runId !== playbackRunRef.current) return undefined;
            const decoded = await decodePromise;
            if (message.runId !== playbackRunRef.current) return undefined;
            setStatus('playing');
            setError('');
            await playDecodedBuffer(decoded, message.runId);
            const pauseMs =
              message.isLastInSection && message.sectionIndex < playableSections.length - 1
                ? safeParagraphPauseMs
                : safeSentencePauseMs;
            await waitForPause(pauseMs, message.runId);
            return undefined;
          });
          return;
        }

        if (message.type === 'done') {
          playbackQueueRef.current = playbackQueueRef.current.then(() => {
            workerMessageCleanupRef.current();
            if (message.runId !== playbackRunRef.current) return undefined;
            setStatus('idle');
            setSectionIndex(0);
            setCompletedAudioSeconds(0);
            setCurrentAudioSeconds(0);
            releaseTtsPlayback(playerIdRef.current);
            return undefined;
          });
          return;
        }

        workerMessageCleanupRef.current();
        setStatus('error');
        setError(message.message);
      };
      worker.addEventListener('message', handleWorkerMessage);
      workerMessageCleanupRef.current = () => worker.removeEventListener('message', handleWorkerMessage);

      worker.postMessage(
        {
          type: 'start',
          runId,
          sections: playableSections,
          startIndex,
          voice,
          speed,
          dtype,
          device,
        },
        { transfer: [] },
      );
    } catch (err) {
      if (playbackRunRef.current !== runId) return;
      releaseTtsPlayback(playerIdRef.current);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unable to start text-to-speech.');
    }
  }

  function handlePlayPause() {
    if (status === 'loading') {
      stopPlayback();
      return;
    }

    if (status === 'playing') {
      void audioContextRef.current?.suspend().then(() => {
        if (activeTtsPlayerId === playerIdRef.current) setStatus('paused');
        return undefined;
      });
      return;
    }

    if (status === 'paused') {
      claimTtsPlayback(playerIdRef.current);
      void audioContextRef.current?.resume().then(() => {
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
