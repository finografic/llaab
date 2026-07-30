import type { TtsDevice, TtsDtype, TtsPlayerSection } from './tts-player.types';
import type { GenerateOptions } from 'kokoro-js';

/**
 * Module-level synthesis engine shared by every `TtsPlayer` instance.
 *
 * Player instances mount and unmount constantly (one per quiz question), so per-instance
 * workers, audio contexts and caches meant every question paid the Kokoro model load again
 * and any in-flight preload was thrown away on unmount. Owning all of it here keeps the
 * model warm, lets a playback request join an in-flight preload, and makes preloaded audio
 * survive the component that requested it.
 */

export interface TtsAudioChunk {
  order: number;
  sectionIndex: number;
  isLastInSection: boolean;
  buffer: AudioBuffer;
}

export interface TtsSynthesisParams {
  sections: TtsPlayerSection[];
  startIndex: number;
  voice: GenerateOptions['voice'];
  speed: number;
  dtype: TtsDtype;
  device: TtsDevice;
}

export interface TtsAudioListener {
  onChunk: (chunk: TtsAudioChunk) => void;
  onProgress: (message: string) => void;
  onSection: (sectionIndex: number) => void;
  onDone: () => void;
  onError: (error: Error) => void;
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

interface SynthesisJob {
  key: string;
  params: TtsSynthesisParams;
  chunks: TtsAudioChunk[];
  listeners: Set<Partial<TtsAudioListener>>;
  /** Preload requests retain a job so unmounting the requester cannot cancel it. */
  retainCount: number;
  settled: boolean;
  runId: number;
  decodeChain: Promise<void>;
  promise: Promise<TtsAudioChunk[]>;
  resolveJob: (chunks: TtsAudioChunk[]) => void;
  rejectJob: (error: Error) => void;
}

const MAX_CACHE_ENTRIES = 24;
/** Bounds decoded-audio memory; quiz stems are short, transcripts are not. */
const MAX_CACHED_AUDIO_SECONDS = 1_200;
/** Keeps a fast reader from building an unbounded prefetch backlog. */
const MAX_PENDING_JOBS = 6;

const audioCache = new Map<string, TtsAudioChunk[]>();
const jobsByKey = new Map<string, SynthesisJob>();
const pendingJobs: SynthesisJob[] = [];
let runningJob: SynthesisJob | null = null;
let sharedWorker: Worker | null = null;
let sharedAudioContext: AudioContext | null = null;
let nextRunId = 0;

function createTtsAudioKey(params: TtsSynthesisParams) {
  return JSON.stringify({
    sections: params.sections.slice(params.startIndex).map((section) => ({
      id: section.id,
      text: section.text,
    })),
    voice: params.voice,
    speed: params.speed,
    dtype: params.dtype,
    device: params.device,
  });
}

/** Created lazily and never closed so decoded buffers stay reusable across questions. */
export function getSharedTtsAudioContext() {
  sharedAudioContext ??= new AudioContext();
  return sharedAudioContext;
}

export async function resumeSharedTtsAudioContext() {
  const context = getSharedTtsAudioContext();
  if (context.state !== 'running') await context.resume();
  return context;
}

/**
 * Call from a real user gesture (e.g. the quiz Start button) to satisfy autoplay policy up
 * front. Without this the first `resume()` happens inside autoplay, adding a round-trip
 * before the first buffer can be scheduled.
 */
export function unlockTtsAudioPlayback() {
  void resumeSharedTtsAudioContext().catch(() => undefined);
}

export async function suspendSharedTtsAudioContext() {
  if (sharedAudioContext?.state === 'running') await sharedAudioContext.suspend();
}

function getCachedAudioSeconds(chunks: TtsAudioChunk[]) {
  return chunks.reduce((total, chunk) => total + chunk.buffer.duration, 0);
}

function evictCacheOverflow() {
  let totalSeconds = [...audioCache.values()].reduce(
    (total, chunks) => total + getCachedAudioSeconds(chunks),
    0,
  );

  for (const [key, chunks] of audioCache) {
    if (audioCache.size <= MAX_CACHE_ENTRIES && totalSeconds <= MAX_CACHED_AUDIO_SECONDS) break;
    audioCache.delete(key);
    totalSeconds -= getCachedAudioSeconds(chunks);
  }
}

export function getCachedTtsAudio(params: TtsSynthesisParams): TtsAudioChunk[] | null {
  const key = createTtsAudioKey(params);
  const chunks = audioCache.get(key);
  if (!chunks) return null;

  // Refresh LRU position.
  audioCache.delete(key);
  audioCache.set(key, chunks);
  return chunks;
}

function getSharedWorker() {
  if (!sharedWorker) {
    sharedWorker = new Worker(new URL('./tts-player.worker.ts', import.meta.url), { type: 'module' });
    sharedWorker.addEventListener('message', handleWorkerMessage);
  }
  return sharedWorker;
}

function emit<K extends keyof TtsAudioListener>(
  job: SynthesisJob,
  event: K,
  ...args: Parameters<TtsAudioListener[K]>
): void {
  // Snapshot: a listener may unsubscribe while being notified.
  const listeners = [...job.listeners];

  for (const listener of listeners) {
    const handler = listener[event];
    // @ts-expect-error -- args are tied to the same listener key.
    handler?.(...args);
  }
}

function handleWorkerMessage(event: MessageEvent<TtsWorkerMessage>) {
  const message = event.data;
  const job = runningJob;
  if (!job || job.runId !== message.runId || job.settled) return;

  if (message.type === 'progress') {
    emit(job, 'onProgress', message.message);
    return;
  }

  if (message.type === 'section') {
    emit(job, 'onSection', message.sectionIndex);
    return;
  }

  if (message.type === 'audio') {
    queueChunkDecode(job, message);
    return;
  }

  if (message.type === 'done') {
    finishJob(job);
    return;
  }

  failJob(job, new Error(message.message));
}

/**
 * Decoding is chained rather than parallel so chunks reach listeners in synthesis order —
 * playback consumes them as a stream and cannot reorder.
 */
function queueChunkDecode(job: SynthesisJob, message: Extract<TtsWorkerMessage, { type: 'audio' }>) {
  job.decodeChain = job.decodeChain
    .then(async () => {
      if (job.settled) return;
      const buffer = await getSharedTtsAudioContext().decodeAudioData(message.buffer);
      if (job.settled) return;

      const chunk: TtsAudioChunk = {
        order: job.chunks.length,
        sectionIndex: message.sectionIndex,
        isLastInSection: message.isLastInSection,
        buffer,
      };
      job.chunks.push(chunk);
      emit(job, 'onChunk', chunk);
      return undefined;
    })
    .catch((err: unknown) => {
      failJob(job, err instanceof Error ? err : new Error('Unable to decode text-to-speech audio.'));
    });
}

function releaseRunningJob(job: SynthesisJob) {
  if (runningJob !== job) return;
  runningJob = null;
  startNextJob();
}

function finishJob(job: SynthesisJob) {
  job.decodeChain = job.decodeChain.then(() => {
    if (job.settled) return undefined;
    job.settled = true;
    jobsByKey.delete(job.key);
    audioCache.set(job.key, job.chunks);
    evictCacheOverflow();
    releaseRunningJob(job);
    emit(job, 'onDone');
    job.listeners.clear();
    job.resolveJob(job.chunks);
    return undefined;
  });
}

function failJob(job: SynthesisJob, error: Error) {
  if (job.settled) return;
  job.settled = true;
  jobsByKey.delete(job.key);
  removePendingJob(job);
  releaseRunningJob(job);
  emit(job, 'onError', error);
  job.listeners.clear();
  job.rejectJob(error);
}

function removePendingJob(job: SynthesisJob) {
  const index = pendingJobs.indexOf(job);
  if (index >= 0) pendingJobs.splice(index, 1);
}

function cancelJob(job: SynthesisJob) {
  if (job.settled) return;
  job.settled = true;
  jobsByKey.delete(job.key);
  removePendingJob(job);

  if (runningJob === job) {
    sharedWorker?.postMessage({ type: 'cancel', runId: job.runId }, { transfer: [] });
    runningJob = null;
    startNextJob();
  }

  job.listeners.clear();
  job.rejectJob(new Error('Text-to-speech request cancelled.'));
}

function startNextJob() {
  if (runningJob) return;

  const job = pendingJobs.shift();
  if (!job) return;
  if (job.settled) {
    startNextJob();
    return;
  }

  runningJob = job;
  nextRunId += 1;
  job.runId = nextRunId;

  getSharedWorker().postMessage(
    {
      type: 'start',
      runId: job.runId,
      sections: job.params.sections,
      startIndex: job.params.startIndex,
      voice: job.params.voice,
      speed: job.params.speed,
      dtype: job.params.dtype,
      device: job.params.device,
    },
    { transfer: [] },
  );
}

function trimPendingBacklog() {
  while (pendingJobs.length >= MAX_PENDING_JOBS) {
    // Drops the stalest queued prefetch (oldest, nobody listening) — a question the reader has
    // most likely already moved past. Anything being played has a listener and is never dropped,
    // and dropped audio is simply re-requested if it turns out to be needed.
    const stale = pendingJobs.find((job) => job.listeners.size === 0);
    if (!stale) return;
    cancelJob(stale);
  }
}

function ensureJob(params: TtsSynthesisParams) {
  const key = createTtsAudioKey(params);
  const existing = jobsByKey.get(key);
  if (existing) return existing;

  trimPendingBacklog();

  const job: SynthesisJob = {
    key,
    params,
    chunks: [],
    listeners: new Set(),
    retainCount: 0,
    settled: false,
    runId: 0,
    decodeChain: Promise.resolve(),
    promise: Promise.resolve([]),
    resolveJob: () => {},
    rejectJob: () => {},
  };

  job.promise = new Promise<TtsAudioChunk[]>((resolve, reject) => {
    job.resolveJob = resolve;
    job.rejectJob = reject;
  });
  // Preload-only jobs may have no awaiting caller; keep cancellation from surfacing as unhandled.
  job.promise.catch(() => undefined);

  jobsByKey.set(key, job);
  pendingJobs.push(job);
  startNextJob();
  return job;
}

function promoteJob(job: SynthesisJob) {
  const index = pendingJobs.indexOf(job);
  if (index <= 0) return;
  pendingJobs.splice(index, 1);
  pendingJobs.unshift(job);
}

/**
 * Preloads audio and keeps the work alive regardless of who unmounts. Resolves from cache
 * when the same text/voice/speed has already been synthesized.
 */
export async function retainTtsAudio(params: TtsSynthesisParams): Promise<TtsAudioChunk[]> {
  const cached = getCachedTtsAudio(params);
  if (cached) return cached;

  const job = ensureJob(params);
  job.retainCount += 1;
  return await job.promise;
}

/**
 * Subscribes to synthesis for playback, joining an in-flight preload rather than restarting it.
 * Already-decoded chunks replay immediately. The returned unsubscribe cancels the job only when
 * nothing else wants it (no other listeners, no preload retain).
 */
export function streamTtsAudio(params: TtsSynthesisParams, listener: Partial<TtsAudioListener>): () => void {
  const job = ensureJob(params);
  promoteJob(job);
  job.listeners.add(listener);

  const decodedChunks = job.chunks;
  for (const chunk of decodedChunks) listener.onChunk?.(chunk);

  return () => {
    job.listeners.delete(listener);
    if (job.listeners.size === 0 && job.retainCount === 0) cancelJob(job);
  };
}
