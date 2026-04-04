import { createNode } from '@llaab/core';
import { toNodeId, type TranscriptSourceType } from '@llaab/schemas';

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

export interface IngestionResult {
  id: string;
  path: string;
  type: 'transcript' | 'resource';
}

async function createResourceNode(
  input: IngestionInput,
  content: string,
  resourceType: 'article' | 'repo',
): Promise<IngestionResult> {
  const extracted = await llmExtract(content);
  const result = await createNode({
    type: 'resource',
    title: input.title,
    body: content,
    tags: [...(input.tags ?? []), 'ingested', resourceType],
    extra: {
      url: input.url,
      resourceType,
      description: extracted.summary,
    },
  });

  return {
    id: result.id,
    path: result.path,
    type: 'resource',
  };
}

async function createTranscriptNode(input: IngestionInput): Promise<IngestionResult> {
  const fetched = await fetchYouTube(input.url);
  const cleaned = cleanTranscript(fetched.rawTranscript);
  const structured = structureText(cleaned.cleanedText);
  const extracted = await llmExtract(structured.structuredContent);

  const transcriptResult = await createNode({
    type: 'transcript',
    title: input.title || fetched.title,
    body: structured.structuredContent,
    tags: [...(input.tags ?? []), 'ingested', 'youtube'],
    extra: {
      sourceUrl: input.url,
      sourceType: input.sourceType as TranscriptSourceType,
      author: fetched.channel,
      summary: extracted.summary,
      rawLength: cleaned.rawLength,
      cleanLength: cleaned.cleanLength,
      structuredParagraphs: structured.paragraphCount,
    },
  });

  const sourceId = toNodeId(fetched.channel);

  try {
    await createNode({
      type: 'source',
      title: fetched.channel,
      tags: ['youtube', 'channel'],
      extra: {
        sourceKind: 'channel',
        url: `https://www.youtube.com/@${fetched.channel.replace(/\s+/g, '')}`,
        platforms: ['youtube'],
        related: [transcriptResult.id],
      },
    });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes(sourceId)) {
      throw error;
    }
  }

  return {
    id: transcriptResult.id,
    path: transcriptResult.path,
    type: 'transcript',
  };
}

export async function runIngestionPipeline(input: IngestionInput): Promise<IngestionResult> {
  if (input.sourceType === 'youtube') {
    return createTranscriptNode(input);
  }

  if (input.sourceType === 'article') {
    return createResourceNode(input, await fetchArticle(input.url), 'article');
  }

  return createResourceNode(input, await fetchRepo(input.url), 'repo');
}
