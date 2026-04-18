import { extractKnowledgeFromTranscript, runIngestionPipeline } from '@llaab/ingestion';
import type { SkillRunRecord } from './runner.js';
import type { ExtractionResult, IngestionResult } from '@llaab/ingestion';

import { runSkill } from './runner.js';

export interface IngestYouTubeInput {
  url: string;
  title?: string;
  tags?: string[];
}

export interface IngestYouTubeOutput {
  record: SkillRunRecord;
  result: IngestionResult;
  extraction?: ExtractionResult;
  extractionError?: string;
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
    return { record, result };
  }

  console.log(`YouTube transcript saved (${record.status}): ${result.id}`);
  console.log(`  -> ${result.path}`);

  // Auto-try extraction — transcript is already persisted, this is best-effort.
  if (result.plainText) {
    try {
      const extraction = await extractKnowledgeFromTranscript(result.id, result.path, result.plainText);
      console.log(`  extraction: ${extraction.ideaIds.length} ideas, summary written`);
      return { record, result, extraction };
    } catch (err) {
      const extractionError = err instanceof Error ? err.message : String(err);
      console.warn(`  extraction failed (transcript saved): ${extractionError}`);
      return { record, result, extractionError };
    }
  }

  return { record, result };
}
