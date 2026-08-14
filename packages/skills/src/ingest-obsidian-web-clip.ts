import { createArticleNodes, extractKnowledgeFromNode, parseObsidianWebClip } from '@llaab/ingestion';
import { formatIsoUtcSeconds } from '@llaab/schemas';
import type { SkillRunRecord } from './runner.js';
import type { ArticleIngestionResult, SavedNodeExtractionResult } from '@llaab/ingestion';

import { appendProducedNodeIds, appendRunEvent, runSkill, setRunLlmTrace } from './runner.js';

export interface IngestObsidianWebClipInput {
  markdown: string;
  tags?: string[];
  skipExtraction?: boolean;
}

export interface IngestObsidianWebClipOutput {
  record: SkillRunRecord;
  result: ArticleIngestionResult;
  extraction?: SavedNodeExtractionResult;
  extractionError?: string;
}

/** Ingest pasted Obsidian Web Clipper Markdown as an article without fetching the source URL. */
export async function ingestObsidianWebClip(
  input: IngestObsidianWebClipInput,
): Promise<IngestObsidianWebClipOutput> {
  const parsed = parseObsidianWebClip(input.markdown);
  const tags = [...new Set([...(parsed.tags ?? []), ...(input.tags ?? [])])];

  const { record, result } = await runSkill(
    'ingest-obsidian-web-clip',
    async (skillInput, runNodeId) => {
      await appendRunEvent(runNodeId, {
        level: 'info',
        message: `Reading Obsidian Web Clip ${skillInput.url}`,
      });

      const article = await createArticleNodes({
        url: skillInput.url,
        title: skillInput.title,
        tags,
        providedArticle: parsed.article,
        providedArticleTags: parsed.tags,
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
    {
      url: parsed.article.canonicalUrl,
      title: parsed.article.title,
      tags,
      markdownLength: input.markdown.length,
    },
    { persistFailedRun: false },
  );

  if (record.status === 'failed') {
    console.error(`Obsidian Web Clip ingestion failed: ${record.error ?? 'unknown error'}`);
    console.error('No failed run node was persisted because the article was not saved.');
    return { record, result };
  }

  console.log(`Obsidian Web Clip saved (${record.status}): ${result.id}`);
  console.log(`  -> ${result.path}`);

  if (!result.plainText || input.skipExtraction) {
    return { record, result };
  }

  await appendRunEvent(record.runNodeId, {
    level: 'info',
    message: 'Extracting ideas from article',
  });

  try {
    const extraction = await extractKnowledgeFromNode(result.id, result.path, result.plainText, tags);

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
