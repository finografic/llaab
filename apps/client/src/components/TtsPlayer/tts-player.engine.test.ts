import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TtsSynthesisParams } from './tts-player.engine';

type EngineModule = typeof import('./tts-player.engine');

interface WorkerMessageEvent {
  data: unknown;
}

type WorkerMessageHandler = (event: WorkerMessageEvent) => void;

class FakeWorker {
  static instances: FakeWorker[] = [];

  listeners = new Set<WorkerMessageHandler>();
  started: Array<{ runId: number; startIndex: number }> = [];
  cancelled: number[] = [];

  constructor() {
    FakeWorker.instances.push(this);
  }

  addEventListener(_type: string, handler: WorkerMessageHandler) {
    this.listeners.add(handler);
  }

  removeEventListener(_type: string, handler: WorkerMessageHandler) {
    this.listeners.delete(handler);
  }

  postMessage(message: { type: string; runId: number; startIndex?: number }) {
    if (message.type === 'start') {
      this.started.push({ runId: message.runId, startIndex: message.startIndex ?? 0 });
    }
    if (message.type === 'cancel') this.cancelled.push(message.runId);
  }

  terminate() {}

  emit(data: unknown) {
    const handlers = [...this.listeners];
    for (const handler of handlers) handler({ data });
  }
}

/** Decodes earlier chunks slower, so parallel decoding would surface as out-of-order chunks. */
class FakeAudioContext {
  state = 'running';

  async resume() {
    this.state = 'running';
  }

  async suspend() {
    this.state = 'suspended';
  }

  async decodeAudioData(buffer: ArrayBuffer) {
    const marker = new Uint8Array(buffer)[0] ?? 0;
    await new Promise((resolve) => setTimeout(resolve, (8 - marker) * 3));
    return { duration: 1, marker } as unknown as AudioBuffer;
  }
}

function createParams(text: string): TtsSynthesisParams {
  return {
    sections: [{ id: 'section-0', text }],
    startIndex: 0,
    voice: 'bm_daniel',
    speed: 1.15,
    dtype: 'fp32',
    device: 'webgpu',
  };
}

function emitChunks(worker: FakeWorker, runId: number, count: number) {
  for (let index = 0; index < count; index += 1) {
    const buffer = new ArrayBuffer(8);
    new Uint8Array(buffer)[0] = index;
    worker.emit({
      type: 'audio',
      runId,
      sectionIndex: 0,
      isLastInSection: index === count - 1,
      buffer,
    });
  }
}

function completeRun(worker: FakeWorker, runId: number, count: number) {
  emitChunks(worker, runId, count);
  worker.emit({ type: 'done', runId });
}

function getChunkMarkers(chunks: Array<{ buffer: AudioBuffer }>) {
  return chunks.map((chunk) => (chunk.buffer as unknown as { marker: number }).marker);
}

let engine: EngineModule;

beforeEach(async () => {
  FakeWorker.instances = [];
  vi.stubGlobal('Worker', FakeWorker);
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.resetModules();
  engine = await import('./tts-player.engine');
});

describe('retainTtsAudio', () => {
  it('resolves decoded chunks and caches them for reuse without a second worker run', async () => {
    const params = createParams('First question stem.');
    const pending = engine.retainTtsAudio(params);
    const [worker] = FakeWorker.instances;

    completeRun(worker, worker.started[0].runId, 2);
    const chunks = await pending;

    expect(chunks).toHaveLength(2);
    expect(engine.getCachedTtsAudio(params)).toHaveLength(2);

    await expect(engine.retainTtsAudio(params)).resolves.toHaveLength(2);
    expect(worker.started).toHaveLength(1);
  });

  it('reuses a single worker across requests so the model stays warm', async () => {
    const first = engine.retainTtsAudio(createParams('One.'));
    const [worker] = FakeWorker.instances;
    completeRun(worker, worker.started[0].runId, 1);
    await first;

    const second = engine.retainTtsAudio(createParams('Two.'));
    completeRun(worker, worker.started[1].runId, 1);
    await second;

    expect(FakeWorker.instances).toHaveLength(1);
    expect(worker.started).toHaveLength(2);
  });

  it('emits chunks in synthesis order even when later chunks decode faster', async () => {
    const pending = engine.retainTtsAudio(createParams('Ordered stem.'));
    const [worker] = FakeWorker.instances;

    completeRun(worker, worker.started[0].runId, 4);

    expect(getChunkMarkers(await pending)).toEqual([0, 1, 2, 3]);
  });
});

describe('streamTtsAudio', () => {
  it('keeps a retained preload alive when the requesting player unmounts', async () => {
    const params = createParams('Preloaded stem.');
    const pending = engine.retainTtsAudio(params);
    const [worker] = FakeWorker.instances;
    const [{ runId }] = worker.started;

    // A player subscribed then unmounted mid-flight; the preload must survive.
    engine.streamTtsAudio(params, {})();
    expect(worker.cancelled).toHaveLength(0);

    completeRun(worker, runId, 2);
    await pending;

    expect(engine.getCachedTtsAudio(params)).toHaveLength(2);
  });

  it('joins an in-flight preload instead of starting a second synthesis run', async () => {
    const params = createParams('Shared stem.');
    const pending = engine.retainTtsAudio(params);
    const [worker] = FakeWorker.instances;
    const received: number[] = [];

    engine.streamTtsAudio(params, {
      onChunk: (chunk) => received.push((chunk.buffer as unknown as { marker: number }).marker),
    });

    completeRun(worker, worker.started[0].runId, 3);
    await pending;

    expect(worker.started).toHaveLength(1);
    expect(received).toEqual([0, 1, 2]);
  });

  it('replays already-decoded chunks to a late subscriber', async () => {
    const params = createParams('Late subscriber stem.');
    const pending = engine.retainTtsAudio(params);
    const [worker] = FakeWorker.instances;
    const [{ runId }] = worker.started;

    const early: number[] = [];
    engine.streamTtsAudio(params, {
      onChunk: (chunk) => early.push((chunk.buffer as unknown as { marker: number }).marker),
    });

    emitChunks(worker, runId, 2);
    await vi.waitFor(() => expect(early).toEqual([0, 1]));

    // A player that starts playback after synthesis began still gets everything decoded so far.
    const received: number[] = [];
    engine.streamTtsAudio(params, {
      onChunk: (chunk) => received.push((chunk.buffer as unknown as { marker: number }).marker),
    });
    expect(received).toEqual([0, 1]);

    worker.emit({ type: 'done', runId });
    await pending;
  });

  it('cancels synthesis when the only listener leaves and nothing retained it', () => {
    const params = createParams('Transcript body.');
    const unsubscribe = engine.streamTtsAudio(params, {});
    const [worker] = FakeWorker.instances;
    const [{ runId }] = worker.started;

    unsubscribe();

    expect(worker.cancelled).toEqual([runId]);
    expect(engine.getCachedTtsAudio(params)).toBeNull();
  });

  it('surfaces worker errors to listeners without caching a partial result', async () => {
    const params = createParams('Failing stem.');
    const pending = engine.retainTtsAudio(params);
    const [worker] = FakeWorker.instances;
    const errors: string[] = [];

    engine.streamTtsAudio(params, { onError: (error) => errors.push(error.message) });
    worker.emit({ type: 'error', runId: worker.started[0].runId, message: 'model failed' });

    await expect(pending).rejects.toThrow('model failed');
    expect(errors).toEqual(['model failed']);
    expect(engine.getCachedTtsAudio(params)).toBeNull();
  });
});
