import { runIngestionPipeline } from '@llaab/ingestion';
import type { SkillRunRecord } from './runner.js';
import type { IngestionResult } from '@llaab/ingestion';

import { runSkill } from './runner.js';

export interface IngestYouTubeInput {
  url: string;
  title?: string;
  tags?: string[];
}

export interface IngestYouTubeOutput {
  record: SkillRunRecord;
  result: IngestionResult;
}

export async function ingestYouTube(input: IngestYouTubeInput): Promise<IngestYouTubeOutput> {
  const { record, result } = await runSkill(
    'ingest-youtube',
    () =>
      runIngestionPipeline({
        sourceType: 'youtube',
        url: input.url,
        ...(input.title !== undefined && input.title !== '' ? { title: input.title } : {}),
        tags: input.tags,
      }),
    input,
  );

  if (record.status === 'failed') {
    console.error(`YouTube ingestion failed: ${record.error ?? 'unknown error'}`);
    console.error(
      'Tip: ingestion uses yt-dlp for metadata and subtitles. Install it and ensure it is on PATH (e.g. brew install yt-dlp).',
    );
    console.error('Full details are in the persisted run node under vault/runs/.');
  } else {
    console.log(`YouTube source ingested (${record.status}): ${result.id}`);
    console.log(`  type: ${result.type}`);
    console.log(`  -> ${result.path}`);
  }

  return { record, result };
}
