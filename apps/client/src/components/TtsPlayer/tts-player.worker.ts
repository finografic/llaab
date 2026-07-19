import { KokoroTTS, TextSplitterStream } from 'kokoro-js';
import type { TtsPlayerSection } from './tts-player.types';
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
}

interface CancelMessage {
  type: 'cancel';
  runId: number;
}

type WorkerInputMessage = StartMessage | CancelMessage;

let ttsPromise: Promise<KokoroTTSInstance> | null = null;
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

async function getTts(runId: number) {
  ttsPromise ??= KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
    dtype: 'q8',
    device: 'wasm',
    progress_callback: (progress) => postProgress(runId, formatKokoroProgress(progress)),
  });

  return await ttsPromise;
}

async function startPlayback(message: StartMessage) {
  activeRunId = message.runId;
  postProgress(message.runId, 'Loading Kokoro model...');

  try {
    const tts = await getTts(message.runId);

    for (let index = message.startIndex; index < message.sections.length; index += 1) {
      if (activeRunId !== message.runId) return;

      const section = message.sections[index];
      if (!section) break;

      postMessage({ type: 'section', runId: message.runId, sectionIndex: index });
      postProgress(message.runId, `Preparing ${section.label ?? `section ${index + 1}`}...`);

      const splitter = new TextSplitterStream();
      const stream = tts.stream(splitter, { voice: message.voice, speed: message.speed });
      for (const sentence of splitTtsSentences(section.text)) splitter.push(`${sentence} `);
      splitter.close();

      for await (const { audio } of stream) {
        if (activeRunId !== message.runId) return;

        const buffer = await audio.toBlob().arrayBuffer();
        postMessage({ type: 'audio', runId: message.runId, buffer }, { transfer: [buffer] });
      }
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
