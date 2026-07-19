import { Button } from 'components/ui/button';
import { PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { TtsPlaybackStatus, TtsPlayerProps, TtsPlayerSection } from './tts-player.types';
import type { KokoroTTS } from 'kokoro-js';

import { createTtsSectionsFromText, formatTtsTime, normalizeTtsText } from './tts-player.utils';
import styles from './TtsPlayer.module.css';

const KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const DEFAULT_VOICE = 'bm_daniel';
const DEFAULT_SPEED = 1;

let ttsPromise: Promise<KokoroTTS> | null = null;

function getTts() {
  ttsPromise ??= import('kokoro-js').then(({ KokoroTTS }) =>
    KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
      dtype: 'q8',
      device: 'wasm',
    }),
  );
  return ttsPromise;
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
      audioRef.current?.pause();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  useEffect(() => {
    setStatus('idle');
    setSectionIndex(0);
    setCompletedAudioSeconds(0);
    setCurrentAudioSeconds(0);
    setError('');
    playbackRunRef.current += 1;
    audioRef.current?.pause();
  }, [playableSections]);

  function clearCurrentAudio() {
    audioRef.current?.pause();
    audioRef.current = null;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  async function playAudioBlob(blob: Blob, runId: number) {
    clearCurrentAudio();
    const objectUrl = URL.createObjectURL(blob);
    objectUrlRef.current = objectUrl;
    const audio = new Audio(objectUrl);
    audioRef.current = audio;

    await new Promise<void>((resolve, reject) => {
      audio.addEventListener('timeupdate', () => {
        if (playbackRunRef.current === runId) setCurrentAudioSeconds(audio.currentTime);
      });
      audio.addEventListener('ended', () => {
        if (playbackRunRef.current === runId) {
          const duration = Number.isFinite(audio.duration) ? audio.duration : audio.currentTime;
          setCompletedAudioSeconds((value) => value + duration);
          setCurrentAudioSeconds(0);
        }
        resolve();
      });
      audio.addEventListener('error', () => reject(new Error('Audio playback failed.')));
      audio.play().catch(reject);
    });
  }

  async function startPlayback(startIndex = sectionIndex) {
    if (!hasSections) return;
    const runId = playbackRunRef.current + 1;
    playbackRunRef.current = runId;
    setStatus('loading');
    setError('');
    setCurrentAudioSeconds(0);

    try {
      const tts = await getTts();
      for (let index = startIndex; index < playableSections.length; index += 1) {
        if (playbackRunRef.current !== runId) return;
        setSectionIndex(index);

        const section = playableSections[index];
        if (!section) break;

        for await (const { audio } of tts.stream(section.text, { voice, speed })) {
          if (playbackRunRef.current !== runId) return;
          setStatus('playing');
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
    if (status === 'playing') {
      audioRef.current?.pause();
      setStatus('paused');
      return;
    }

    if (status === 'paused') {
      void audioRef.current?.play();
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
        disabled={!hasSections || status === 'loading'}
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
