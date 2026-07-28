import { ArticleFetchError, createArticleNodes, extractKnowledgeFromNode } from '@llaab/ingestion';
import { formatIsoUtcSeconds } from '@llaab/schemas';
import type { SkillRunRecord } from './runner.js';
import type { ArticleIngestionResult, SavedNodeExtractionResult } from '@llaab/ingestion';

import { appendProducedNodeIds, appendRunEvent, runSkill, setRunLlmTrace } from './runner.js';

export interface IngestArticleInput {
  url: string;
  title?: string;
  tags?: string[];
  skipExtraction?: boolean;
  /** Inbox capture that triggered this ingest, preserved as provenance on the article. */
  inboxCaptureId?: string;
}

export interface IngestArticleOutput {
  record: SkillRunRecord;
  result: ArticleIngestionResult;
  extraction?: SavedNodeExtractionResult;
  extractionError?: string;
}

/**
 * Durable, one-shot article ingestion.
 *
 * The article and its publication source are saved before extraction runs, so a failed or skipped
 * extraction still leaves a readable, searchable, retryable article and a completed run.
 */
export async function ingestArticle(input: IngestArticleInput): Promise<IngestArticleOutput> {
  const { record, result } = await runSkill(
    'ingest-article',
    async (skillInput, runNodeId) => {
      await appendRunEvent(runNodeId, {
        level: 'info',
        message: `Fetching article ${skillInput.url}`,
      });

      const article = await createArticleNodes({
        url: skillInput.url,
        ...(skillInput.title ? { title: skillInput.title } : {}),
        ...(skillInput.tags ? { tags: skillInput.tags } : {}),
        ...(skillInput.inboxCaptureId ? { inboxCaptureId: skillInput.inboxCaptureId } : {}),
      });

      await appendRunEvent(runNodeId, {
        level: 'success',
        message: article.reused
          ? `Reused existing article "${article.title}"`
          : `Saved article "${article.title}"`,
        node_ids: article.producedNodeIds,
        href: `/vault/resources/${article.id}`,
      });

      return article;
    },
    input,
    { persistFailedRun: false },
  );

  if (record.status === 'failed') {
    console.error(`Article ingestion failed: ${record.error ?? 'unknown error'}`);
    console.error('No failed run node was persisted because the article was not saved.');
    return { record, result };
  }

  console.log(`Article saved (${record.status}): ${result.id}`);
  console.log(`  -> ${result.path}`);

  if (!result.plainText || input.skipExtraction) {
    return { record, result };
  }

  // The article is already persisted; extraction is best-effort from here on.
  await appendRunEvent(record.runNodeId, {
    level: 'info',
    message: 'Extracting ideas from article',
  });

  try {
    const extraction = await extractKnowledgeFromNode(result.id, result.path, result.plainText, input.tags);

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
      message: `Extraction failed (article saved): ${extractionError}`,
    });
    console.warn(`  extraction failed (article saved): ${extractionError}`);
    return { record, result, extractionError };
  }
}

/** Maps a fetch failure onto an operator-facing message, without leaking response detail. */
export function describeArticleIngestError(error: unknown): string {
  if (error instanceof ArticleFetchError) {
    return `${error.code}: ${error.message}`;
  }
  return error instanceof Error ? error.message : String(error);
}
