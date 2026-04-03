import { createNode } from '@llaab/core';

import { cleanTranscript } from './clean/transcript.js';
import { llmExtract } from './extract/llm-extract.js';
import { fetchArticle } from './fetch/article.js';
import { fetchRepo } from './fetch/repo.js';
import { fetchYouTube } from './fetch/youtube.js';
import { structureText } from './structure/text.js';

export type IngestionSourceType = 'youtube' | 'article' | 'repo';

export interface IngestionInput {
  sourceType: IngestionSourceType;
  url: string;
  title: string;
  tags?: string[];
}

export async function runIngestionPipeline(input: IngestionInput): Promise<{ id: string; path: string }> {
  const rawContent =
    input.sourceType === 'youtube'
      ? await fetchYouTube(input.url)
      : input.sourceType === 'article'
        ? await fetchArticle(input.url)
        : await fetchRepo(input.url);

  const cleaned = cleanTranscript(rawContent);
  const structured = structureText(cleaned);
  const extracted = await llmExtract(structured);

  return createNode({
    type: 'resource',
    title: input.title,
    body: [`Source: ${input.url}`, '', structured, '', `Summary: ${extracted.summary}`].join('\n'),
    tags: input.tags,
  });
}
