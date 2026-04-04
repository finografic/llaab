import { type IngestionResult, runIngestionPipeline } from '@llaab/ingestion';

import { runSkill } from './runner.js';

export interface IngestYouTubeInput {
  url: string;
  title?: string;
  tags?: string[];
}

export async function ingestYouTube(input: IngestYouTubeInput): Promise<void> {
  const { record, result } = await runSkill(
    'ingest-youtube',
    () =>
      runIngestionPipeline({
        sourceType: 'youtube',
        url: input.url,
        title: input.title ?? 'Untitled transcript',
        tags: input.tags,
      }),
    input,
  );

  console.log(`YouTube source ingested (${record.status}): ${result.id}`);
  console.log(`  type: ${(result as IngestionResult).type}`);
  console.log(`  -> ${result.path}`);
}
