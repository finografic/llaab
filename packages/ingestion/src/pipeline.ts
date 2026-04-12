import { createNode, getNodeFilePath, listNodes } from '@llaab/core';
import { appendDatetimeFilenameSegment, toNodeId, type TranscriptSourceType } from '@llaab/schemas';
import type { ExtractionRunTrace } from './extract/llm-extract.js';

import { applyKnownTranscriptReplacements } from './clean/transcript-replacements.js';
import { cleanTranscript } from './clean/transcript.js';
import { llmExtractWithTrace } from './extract/llm-extract.js';
import { fetchArticle } from './fetch/article.js';
import { fetchRepo } from './fetch/repo.js';
import { fetchYouTube, parseYouTubeUrl } from './fetch/youtube.js';
import { structureText } from './structure/text.js';

export type IngestionSourceType = 'youtube' | 'article' | 'repo';

export interface IngestionInput {
  sourceType: IngestionSourceType;
  url: string;
  /** Optional display name override. For YouTube, defaults to the video title from metadata when omitted. */
  title?: string;
  tags?: string[];
}

function resolveYouTubeTranscriptTitle(
  inputTitle: string | undefined,
  fetchedTitle: string,
): { title: string; idWhenUntitled: string | undefined } {
  const override = inputTitle?.trim();
  if (override) return { title: override, idWhenUntitled: undefined };
  const fromMeta = fetchedTitle.trim();
  if (fromMeta) return { title: fromMeta, idWhenUntitled: undefined };
  return {
    title: 'Untitled transcript',
    idWhenUntitled: appendDatetimeFilenameSegment('untitled', new Date()),
  };
}

function markdownH1Line(title: string): string {
  const singleLine = title.replace(/\r?\n/g, ' ').trim();
  const withoutLeadingHashes = singleLine.replace(/^#+\s*/, '');
  return `# ${withoutLeadingHashes}`;
}

export interface IngestionResult {
  id: string;
  path: string;
  type: 'transcript' | 'resource';
  producedNodeIds?: string[];
  runTrace?: ExtractionRunTrace;
}

function completedStage(
  name: string,
  input?: unknown,
  output?: unknown,
): ExtractionRunTrace['stages'][number] {
  return {
    name,
    status: 'completed',
    input,
    output,
  };
}

async function findExistingYouTubeTranscript(sourceItemId: string): Promise<IngestionResult | undefined> {
  const nodes = await listNodes({ type: 'transcript' });
  const existing = nodes.find(
    (node) =>
      node.type === 'transcript' && node.sourceType === 'youtube' && node.sourceItemId === sourceItemId,
  );

  if (!existing) {
    return undefined;
  }

  return {
    id: existing.id,
    path: getNodeFilePath('transcript', existing.id),
    type: 'transcript',
    producedNodeIds: [existing.id],
    runTrace: {
      stages: [
        completedStage(
          'dedupe:transcript',
          { sourceType: 'youtube', sourceItemId },
          { id: existing.id, reused: true },
        ),
      ],
      decisions: [
        {
          type: 'accept',
          reason: `Existing transcript reused for YouTube video "${sourceItemId}".`,
        },
      ],
    },
  };
}

async function createResourceNode(
  input: IngestionInput,
  content: string,
  resourceType: 'article' | 'repo',
): Promise<IngestionResult> {
  const extracted = await llmExtractWithTrace(content);
  const result = await createNode({
    type: 'resource',
    title: input.title?.trim() || 'Untitled resource',
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
    producedNodeIds: [result.id],
    runTrace: extracted.runTrace,
  };
}

async function createTranscriptNode(input: IngestionInput): Promise<IngestionResult> {
  const captured = parseYouTubeUrl(input.url);
  const existingTranscript = await findExistingYouTubeTranscript(captured.videoId);

  if (existingTranscript) {
    return existingTranscript;
  }

  const fetched = await fetchYouTube(input.url);
  const { title: transcriptTitle, idWhenUntitled } = resolveYouTubeTranscriptTitle(
    input.title,
    fetched.title,
  );
  const stages: ExtractionRunTrace['stages'] = [
    completedStage(
      'fetch:youtube',
      { url: input.url },
      {
        title: fetched.title,
        channel: fetched.channel,
        sourceItemId: captured.videoId,
        duration: fetched.duration,
        uploadDate: fetched.uploadDate,
        hasTranscript: fetched.rawTranscript.length > 0,
      },
    ),
  ];
  const cleaned = cleanTranscript(fetched.rawTranscript);
  stages.push(
    completedStage(
      'clean:transcript',
      { rawLength: cleaned.rawLength },
      {
        cleanLength: cleaned.cleanLength,
      },
    ),
  );
  const sanitizedText = applyKnownTranscriptReplacements(cleaned.cleanedText);
  stages.push(
    completedStage(
      'sanitize:transcript',
      { cleanLength: cleaned.cleanLength },
      {
        cleanLength: sanitizedText.length,
      },
    ),
  );
  const structured = structureText(sanitizedText);
  stages.push(
    completedStage(
      'structure:text',
      { cleanLength: sanitizedText.length },
      {
        paragraphCount: structured.paragraphCount,
        contentLength: structured.structuredContent.length,
      },
    ),
  );
  const extracted = await llmExtractWithTrace(structured.structuredContent);
  stages.push(...extracted.runTrace.stages);
  const sourceId = toNodeId(fetched.channel);
  const producedNodeIds = new Set<string>();

  const transcriptBody = `${markdownH1Line(transcriptTitle)}\n\n${structured.structuredContent}`;

  const transcriptResult = await createNode({
    type: 'transcript',
    ...(idWhenUntitled !== undefined ? { id: idWhenUntitled } : {}),
    title: transcriptTitle,
    body: transcriptBody,
    tags: [...(input.tags ?? []), 'ingested', 'youtube'],
    extra: {
      sourceId,
      sourceItemId: captured.videoId,
      sourceUrl: input.url,
      sourceType: input.sourceType as TranscriptSourceType,
      author: fetched.channel,
      summary: extracted.summary,
      rawLength: cleaned.rawLength,
      cleanLength: sanitizedText.length,
      structuredParagraphs: structured.paragraphCount,
    },
  });
  producedNodeIds.add(transcriptResult.id);
  stages.push(
    completedStage(
      'store:transcript',
      { type: 'transcript', sourceId },
      {
        id: transcriptResult.id,
        path: transcriptResult.path,
      },
    ),
  );

  try {
    const sourceResult = await createNode({
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
    producedNodeIds.add(sourceId);
    stages.push(
      completedStage(
        'store:source',
        { id: sourceId },
        {
          id: sourceResult.id,
          path: sourceResult.path,
          reused: false,
        },
      ),
    );
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes(sourceId)) {
      throw error;
    }

    stages.push(
      completedStage(
        'store:source',
        { id: sourceId },
        {
          id: sourceId,
          reused: true,
        },
      ),
    );
  }

  return {
    id: transcriptResult.id,
    path: transcriptResult.path,
    type: 'transcript',
    producedNodeIds: [...producedNodeIds],
    runTrace: {
      stages,
      decisions: extracted.runTrace.decisions,
      llm: extracted.runTrace.llm,
    },
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
