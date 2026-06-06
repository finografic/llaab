import { autoTag, createNode, getNodeFilePath, listNodes, updateNode } from '@llaab/core';
import { appendDatetimeFilenameSegment, formatIsoUtcForTranscriptBody, now, toNodeId } from '@llaab/schemas';
import type { ExtractionRunTrace } from './extract/llm-extract.js';
import type { TranscriptSourceType } from '@llaab/schemas';

import { applyKnownTranscriptReplacements } from './clean/transcript-replacements.js';
import { cleanTranscript } from './clean/transcript.js';
import { llmExtractWithTrace } from './extract/llm-extract.js';
import { fetchArticle } from './fetch/article.js';
import { fetchRepo } from './fetch/repo.js';
import { fetchYouTube, parseYouTubeUrl } from './fetch/youtube.js';
import { structureText } from './structure/text.js';

// At the top — new import
import { isSrtFormat, parseSrtTranscript } from './structure/srt-parser.utils.js';

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

/** Human-visible header: video link, author (linked when URL known), upload + ingest times without `T`/`Z`. */
function youtubeTranscriptVisibleHeader(
  sourceUrl: string,
  sourceId: string,
  ingestedIsoUtc: string,
  options: { channelUrl?: string; uploadedDisplay?: string },
): string {
  const linkLine = `[**${sourceUrl}**](${sourceUrl})`;
  const authorLine =
    options.channelUrl && options.channelUrl.startsWith('http')
      ? `**author:** [**${sourceId}**](${options.channelUrl})`
      : `**author:** ${sourceId}`;
  const uploaded = options.uploadedDisplay ?? '—';
  const ingested = formatIsoUtcForTranscriptBody(ingestedIsoUtc);
  return `${linkLine}\n${authorLine}\n**uploaded:** ${uploaded}\n**ingested:** ${ingested}\n\n## Transcript`;
}

export interface IngestionResult {
  id: string;
  path: string;
  type: 'transcript' | 'resource';
  producedNodeIds?: string[];
  runTrace?: ExtractionRunTrace;
  /** Plain text available for extraction — present on fresh transcript ingestion, absent on dedup. */
  plainText?: string;
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
      node.type === 'transcript' && node.source_type === 'youtube' && node.source_item_id === sourceItemId,
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
    tags: [...new Set(['d:ingest', ...autoTag(input.title?.trim() ?? '', ''), ...(input.tags ?? [])])],
    extra: {
      url: input.url,
      resource_type: resourceType,
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

  let structuredContent: string;
  let plainTextForExtraction: string;
  let paragraphCount: number;
  let rawLength: number;
  let cleanLength: number;

  if (isSrtFormat(fetched.rawTranscript)) {
    const parsed = parseSrtTranscript(fetched.rawTranscript);
    structuredContent = parsed.structuredContent;
    plainTextForExtraction = applyKnownTranscriptReplacements(parsed.plainText);
    paragraphCount = parsed.paragraphCount;
    rawLength = parsed.rawLength;
    cleanLength = parsed.cleanLength;

    stages.push(
      completedStage(
        'parse:srt',
        { rawLength },
        {
          cleanLength,
          paragraphCount,
          contentLength: structuredContent.length,
          format: 'srt',
        },
      ),
    );
  } else {
    // Fallback for non-SRT content (future article transcripts, etc.)
    const cleaned = cleanTranscript(fetched.rawTranscript);
    rawLength = cleaned.rawLength;

    const sanitizedText = applyKnownTranscriptReplacements(cleaned.cleanedText);
    cleanLength = sanitizedText.length;

    const structured = structureText(sanitizedText);
    structuredContent = structured.structuredContent;
    plainTextForExtraction = sanitizedText;
    paragraphCount = structured.paragraphCount;

    stages.push(
      completedStage('clean:transcript', { rawLength }, { cleanLength: cleaned.cleanLength }),
      completedStage(
        'sanitize:transcript',
        { cleanLength: cleaned.cleanLength },
        { cleanLength: sanitizedText.length },
      ),
      completedStage(
        'structure:text',
        { cleanLength: sanitizedText.length },
        { paragraphCount, contentLength: structuredContent.length },
      ),
    );
  }

  const sourceId = toNodeId(fetched.channel);
  const producedNodeIds = new Set<string>();

  const updatedAtIso = now();
  const transcriptBody = `${markdownH1Line(transcriptTitle)}\n\n${youtubeTranscriptVisibleHeader(
    input.url,
    sourceId,
    updatedAtIso,
    {
      channelUrl: fetched.channelUrl,
      uploadedDisplay: fetched.uploadedDisplay,
    },
  )}\n\n${structuredContent}`;

  const transcriptResult = await createNode({
    type: 'transcript',
    ...(idWhenUntitled !== undefined ? { id: idWhenUntitled } : {}),
    title: transcriptTitle,
    body: transcriptBody,
    tags: [...new Set(['d:ingest', ...autoTag(transcriptTitle, ''), ...(input.tags ?? [])])],
    extra: {
      source_id: sourceId,
      source_item_id: captured.videoId,
      source_url: input.url,
      source_type: input.sourceType as TranscriptSourceType,
      author: fetched.channel,
      raw_length: rawLength,
      clean_length: cleanLength,
      structured_paragraphs: paragraphCount,
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
      tags: [],
      extra: {
        source_kind: 'channel',
        url: fetched.channelUrl ?? `https://www.youtube.com/@${fetched.channel.replace(/\s+/g, '')}`,
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
    plainText: plainTextForExtraction,
    runTrace: { stages, decisions: [], llm: undefined },
  };
}

export interface ExtractionResult {
  transcriptId: string;
  summary: string;
  ideaIds: string[];
  ideas: Array<{ id: string; title: string }>;
}

/**
 * Run LLM knowledge extraction on an already-saved transcript. Updates the transcript's summary and creates
 * IdeaNodes for each extracted idea. Safe to call after ingest — transcript is already persisted regardless
 * of outcome.
 */
export async function extractKnowledgeFromTranscript(
  transcriptId: string,
  transcriptPath: string,
  plainText: string,
): Promise<ExtractionResult> {
  const extracted = await llmExtractWithTrace(plainText);

  await updateNode(transcriptPath, (node) => ({
    ...node,
    summary: extracted.summary,
    tags: [...new Set([...(node.tags ?? []), ...autoTag(node.title, extracted.summary)])],
    llm_model: extracted.llmMeta.model,
    llm_provider: extracted.llmMeta.provider,
    llm_duration_ms: extracted.llmMeta.durationMs,
    llm_prompt_tokens: extracted.llmMeta.promptTokens,
    llm_completion_tokens: extracted.llmMeta.completionTokens,
  }));

  const ideas: Array<{ id: string; title: string }> = [];
  for (const ideaText of extracted.ideas) {
    const idea = await createNode({
      type: 'idea',
      title: ideaText,
      body: '',
      tags: [...new Set(['d:ingest', ...autoTag(ideaText, '')])],
      extra: {
        origin: 'extracted',
        source_id: transcriptId,
        related: [transcriptId],
        llm_model: extracted.llmMeta.model,
        llm_provider: extracted.llmMeta.provider,
        llm_duration_ms: extracted.llmMeta.durationMs,
        llm_prompt_tokens: extracted.llmMeta.promptTokens,
        llm_completion_tokens: extracted.llmMeta.completionTokens,
      },
    });
    ideas.push({ id: idea.id, title: ideaText });
  }

  const ideaIds = ideas.map((i) => i.id);

  await updateNode(transcriptPath, (node) => ({
    ...node,
    extracted_idea_ids: ideaIds,
    llm_model: extracted.llmMeta.model,
    llm_provider: extracted.llmMeta.provider,
    llm_duration_ms: extracted.llmMeta.durationMs,
    llm_prompt_tokens: extracted.llmMeta.promptTokens,
    llm_completion_tokens: extracted.llmMeta.completionTokens,
  }));

  return { transcriptId, summary: extracted.summary, ideaIds, ideas };
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
