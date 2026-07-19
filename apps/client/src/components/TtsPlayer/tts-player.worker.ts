import { KokoroTTS } from 'kokoro-js';
import type { TtsDevice, TtsDtype, TtsPlayerSection } from './tts-player.types';
import type { GenerateOptions, KokoroTTS as KokoroTTSInstance } from 'kokoro-js';

import { splitTtsSentences } from './tts-player.utils';

const KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

interface StartMessage {
  type: 'start';
  runId: number;
  sections: TtsPlayerSection[];
  startIndex: number;
  voice: GenerateOptions['voice'];
  speed: number;
  dtype: TtsDtype;
  device: TtsDevice;
}

interface CancelMessage {
  type: 'cancel';
  runId: number;
}

type WorkerInputMessage = StartMessage | CancelMessage;

interface ChunkQueueItem {
  sectionIndex: number;
  isLastInSection: boolean;
  text: string;
}

let ttsPromise: Promise<KokoroTTSInstance> | null = null;
let loadedDtype: TtsDtype | null = null;
let loadedDevice: TtsDevice | null = null;
let activeRunId = 0;

function formatKokoroProgress(progress: unknown) {
  if (!progress || typeof progress !== 'object') return 'Loading Kokoro model...';
  const data = progress as { file?: string; progress?: number; status?: string };
  const percent = typeof data.progress === 'number' ? ` ${Math.round(data.progress)}%` : '';
  const file = data.file ? ` ${data.file}` : '';
  return `${data.status ?? 'Loading'}${percent}${file}`.trim();
}

function postProgress(runId: number, message: string) {
  if (activeRunId === runId) postMessage({ type: 'progress', runId, message });
}

async function getTts(runId: number, dtype: TtsDtype, device: TtsDevice) {
  if (ttsPromise && (loadedDtype !== dtype || loadedDevice !== device)) {
    ttsPromise = null;
    loadedDtype = null;
    loadedDevice = null;
  }

  ttsPromise ??= KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
    dtype,
    device,
    progress_callback: (progress) => postProgress(runId, formatKokoroProgress(progress)),
  }).then((tts) => {
    loadedDtype = dtype;
    loadedDevice = device;
    return tts;
  });

  return await ttsPromise;
}

function createChunkQueue(message: StartMessage) {
  // Sentence-sized chunks keep time-to-first-audio low; the main thread plays while
  // this worker synthesizes ahead (works well with fp32 + webgpu).
  return message.sections.slice(message.startIndex).flatMap((section, offset) => {
    const sectionIndex = message.startIndex + offset;
    const sentences = splitTtsSentences(section.text);
    return sentences.map(
      (sentence, sentenceIndex): ChunkQueueItem => ({
        sectionIndex,
        isLastInSection: sentenceIndex === sentences.length - 1,
        text: sentence,
      }),
    );
  });
}

async function startPlayback(message: StartMessage) {
  activeRunId = message.runId;
  postProgress(message.runId, 'Loading Kokoro model...');

  try {
    const tts = await getTts(message.runId, message.dtype, message.device);
    const chunkQueue = createChunkQueue(message);

    let activeSectionIndex: number | null = null;
    for (const item of chunkQueue) {
      if (activeRunId !== message.runId) return;

      const section = message.sections[item.sectionIndex];
      if (item.sectionIndex !== activeSectionIndex) {
        activeSectionIndex = item.sectionIndex;
        postMessage({ type: 'section', runId: message.runId, sectionIndex: item.sectionIndex });
      }
      postProgress(message.runId, `Preparing ${section?.label ?? `section ${item.sectionIndex + 1}`}...`);

      // Post as soon as ready so the UI can play chunk N while we synthesize N+1.
      const audio = await tts.generate(item.text, { voice: message.voice, speed: message.speed });
      if (activeRunId !== message.runId) return;

      const buffer = await audio.toBlob().arrayBuffer();
      postMessage(
        {
          type: 'audio',
          runId: message.runId,
          sectionIndex: item.sectionIndex,
          isLastInSection: item.isLastInSection,
          buffer,
        },
        { transfer: [buffer] },
      );
    }

    if (activeRunId === message.runId) postMessage({ type: 'done', runId: message.runId });
  } catch (err) {
    if (activeRunId !== message.runId) return;
    postMessage({
      type: 'error',
      runId: message.runId,
      message: err instanceof Error ? err.message : 'Unable to generate text-to-speech.',
    });
  }
}

addEventListener('message', (event: MessageEvent<WorkerInputMessage>) => {
  if (event.data.type === 'cancel') {
    if (activeRunId === event.data.runId) activeRunId += 1;
    return;
  }

  void startPlayback(event.data);
});
