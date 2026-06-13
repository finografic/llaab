import { extractKnowledgeFromTranscript, runIngestionPipeline } from '@llaab/ingestion';
import { formatIsoUtcSeconds } from '@llaab/schemas';
import type { SkillRunRecord } from './runner.js';
import type { ExtractionResult, IngestionResult } from '@llaab/ingestion';

import { appendProducedNodeIds, appendRunEvent, runSkill, setRunLlmTrace } from './runner.js';

export interface IngestYouTubeInput {
  url: string;
  title?: string;
  tags?: string[];
  skipExtraction?: boolean;
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
    async (skillInput, runNodeId) => {
      const pipelineResult = await runIngestionPipeline({
        sourceType: 'youtube',
        url: skillInput.url,
        ...(skillInput.title !== undefined && skillInput.title !== '' ? { title: skillInput.title } : {}),
        tags: skillInput.tags,
      });

      await appendRunEvent(runNodeId, {
        level: 'success',
        message: `Saved transcript "${pipelineResult.id}"`,
        node_ids: [pipelineResult.id],
        href: `/vault/transcripts/${pipelineResult.id}`,
      });

      return pipelineResult;
    },
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
  if (result.plainText && !input.skipExtraction) {
    await appendRunEvent(record.runNodeId, {
      level: 'info',
      message: 'Extracting ideas from transcript',
    });

    try {
      const extraction = await extractKnowledgeFromTranscript(
        result.id,
        result.path,
        result.plainText,
        input.tags,
      );
      await appendProducedNodeIds(record.runNodeId, extraction.ideaIds, {
        completedAt: formatIsoUtcSeconds(new Date()),
      });
      await setRunLlmTrace(record.runNodeId, {
        model: extraction.llmMeta.model,
        provider: extraction.llmMeta.provider,
        duration_ms: extraction.llmMeta.durationMs,
        prompt_tokens: extraction.llmMeta.promptTokens,
        completion_tokens: extraction.llmMeta.completionTokens,
      });
      await appendRunEvent(record.runNodeId, {
        level: 'success',
        message: `Extracted ${extraction.ideaIds.length} idea${extraction.ideaIds.length === 1 ? '' : 's'}`,
        node_ids: extraction.ideaIds,
      });
      console.log(`  extraction: ${extraction.ideaIds.length} ideas, summary written`);
      return { record, result, extraction };
    } catch (err) {
      const extractionError = err instanceof Error ? err.message : String(err);
      await appendRunEvent(record.runNodeId, {
        level: 'warning',
        message: `Extraction failed (transcript saved): ${extractionError}`,
      });
      console.warn(`  extraction failed (transcript saved): ${extractionError}`);
      return { record, result, extractionError };
    }
  }

  return { record, result };
}
