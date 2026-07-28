import { autoTag, createNode, getNodeFilePath, listNodes, updateNode } from '@llaab/core';
import { appendDatetimeFilenameSegment, formatIsoUtcForTranscriptBody, now, toNodeId } from '@llaab/schemas';
import type { ExtractionRunTrace } from './extract/llm-extract.js';
import type { FetchedPodcastEpisode } from './fetch/podcast.js';
import type { SourceNode, TranscriptNode, TranscriptSourceType } from '@llaab/schemas';

import { createArticleNodes } from './article/create-article-nodes.js';
import { applyKnownTranscriptReplacements } from './clean/transcript-replacements.js';
import { cleanTranscript } from './clean/transcript.js';
import {
  matchPodcastEpisodeOnYouTube,
  resolveTrustedYouTubeChannelId,
} from './enrich/match-podcast-youtube.js';
import { llmExtractWithTrace, normalizeContentTags, normalizeDomainTags } from './extract/llm-extract.js';
import { fetchPodcastEpisode } from './fetch/podcast.js';
import { fetchRepo } from './fetch/repo.js';
import { fetchYouTube, parseYouTubeUrl } from './fetch/youtube.js';
import { structureText } from './structure/text.js';
import { transcribeAudioLocally } from './transcribe/mlx-whisper.js';

// At the top — new import
import { isSrtFormat, parseSrtTranscript } from './structure/srt-parser.utils.js';

export type IngestionSourceType = 'youtube' | 'article' | 'repo' | 'podcast';

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

function youtubePublishedAtIso(uploadDate: string, uploadedDisplay?: string): string | undefined {
  if (uploadedDisplay && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(uploadedDisplay)) {
    return `${uploadedDisplay.replace(' ', 'T')}Z`;
  }

  if (uploadDate.length === 8 && /^\d{8}$/.test(uploadDate)) {
    return `${uploadDate.slice(0, 4)}-${uploadDate.slice(4, 6)}-${uploadDate.slice(6, 8)}T00:00:00Z`;
  }

  return undefined;
}

export interface IngestionResult {
  id: string;
  path: string;
  type: 'transcript' | 'resource';
  title?: string;
  sourceId?: string;
  sourceItemId?: string;
  sourceUrl?: string;
  author?: string;
  producedNodeIds?: string[];
  reused?: boolean;
  runTrace?: ExtractionRunTrace;
  /** Plain text available for extraction. Deduped transcripts reuse the persisted transcript body. */
  plainText?: string;
  /** Articles only: canonical URL used as durable identity. */
  canonicalUrl?: string;
  /** Articles only: SHA-256 of the normalized article text. */
  contentHash?: string;
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
  ) as TranscriptNode | undefined;

  if (!existing) {
    return undefined;
  }

  return {
    id: existing.id,
    path: getNodeFilePath('transcript', existing.id),
    type: 'transcript',
    title: existing.title,
    sourceId: existing.source_id,
    sourceItemId: existing.source_item_id,
    sourceUrl: existing.source_url,
    author: existing.author,
    producedNodeIds: [existing.id],
    reused: true,
    plainText: existing.body,
    runTrace: {
      stages: [
        completedStage(
          'dedupe:transcript',
          { sourceType: 'youtube', sourceItemId },
          {
            id: existing.id,
            path: getNodeFilePath('transcript', existing.id),
            title: existing.title,
            sourceId: existing.source_id,
            sourceItemId: existing.source_item_id,
            sourceUrl: existing.source_url,
            author: existing.author,
            reused: true,
          },
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

async function findExistingPodcastTranscript(episodeGuid: string): Promise<IngestionResult | undefined> {
  const nodes = await listNodes({ type: 'transcript' });
  const existing = nodes.find(
    (node) =>
      node.type === 'transcript' &&
      node.source_type === 'podcast' &&
      node.podcast_episode_guid === episodeGuid,
  ) as TranscriptNode | undefined;

  if (!existing) {
    return undefined;
  }

  return {
    id: existing.id,
    path: getNodeFilePath('transcript', existing.id),
    type: 'transcript',
    title: existing.title,
    sourceId: existing.source_id,
    sourceItemId: existing.source_item_id,
    sourceUrl: existing.source_url,
    author: existing.author,
    producedNodeIds: [existing.id],
    reused: true,
    plainText: existing.body,
    runTrace: {
      stages: [
        completedStage(
          'dedupe:transcript',
          { sourceType: 'podcast', episodeGuid },
          {
            id: existing.id,
            path: getNodeFilePath('transcript', existing.id),
            title: existing.title,
            reused: true,
          },
        ),
      ],
      decisions: [
        {
          type: 'accept',
          reason: `Existing transcript reused for podcast episode "${episodeGuid}".`,
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
  const publishedAt = youtubePublishedAtIso(fetched.uploadDate, fetched.uploadedDisplay);

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
      ...(publishedAt ? { source_published_at: publishedAt } : {}),
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
        platform_id: fetched.channelId,
        subscriber_count: fetched.channelSubscriberCount,
        verified: fetched.channelVerified,
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
    title: transcriptTitle,
    sourceId,
    sourceItemId: captured.videoId,
    sourceUrl: input.url,
    author: fetched.channel,
    producedNodeIds: [...producedNodeIds],
    plainText: plainTextForExtraction,
    runTrace: { stages, decisions: [], llm: undefined },
  };
}

/** Human-visible header: episode/show link, air date, ingest time. Mirrors the YouTube header shape. */
function podcastTranscriptVisibleHeader(
  sourceUrl: string,
  podcastTitle: string,
  ingestedIsoUtc: string,
  publishedAt?: string,
): string {
  const linkLine = `[**${sourceUrl}**](${sourceUrl})`;
  const authorLine = `**show:** ${podcastTitle}`;
  const published = publishedAt ? formatIsoUtcForTranscriptBody(publishedAt) : '—';
  const ingested = formatIsoUtcForTranscriptBody(ingestedIsoUtc);
  return `${linkLine}\n${authorLine}\n**published:** ${published}\n**ingested:** ${ingested}\n\n## Transcript`;
}

async function fetchRssTranscriptText(transcriptUrl: string): Promise<string> {
  const response = await fetch(transcriptUrl);
  if (!response.ok) {
    throw new Error(`Could not fetch RSS transcript (HTTP ${response.status}): ${transcriptUrl}`);
  }
  return response.text();
}

/**
 * If this podcast's source already has a trusted YouTube channel match (see
 * match-podcast-youtube.ts), tries to find this specific episode's upload there and pull its
 * captions — far faster than local mlx-whisper transcription. Returns undefined on any failure
 * or low-confidence result so the caller falls back to whisper.
 */
async function tryYouTubeEpisodeTranscript(
  sourceId: string,
  fetched: FetchedPodcastEpisode,
): Promise<{ videoUrl: string; rawTranscript: string; channelSourceId?: string } | undefined> {
  try {
    const sources = (await listNodes({ type: 'source' })) as SourceNode[];
    const existingSource = sources.find((node) => node.id === sourceId);
    if (!existingSource) return undefined;

    const channelId = resolveTrustedYouTubeChannelId(existingSource);
    if (!channelId) return undefined;

    const episodeMatch = await matchPodcastEpisodeOnYouTube(
      channelId,
      fetched.episodeTitle,
      fetched.publishedAt,
    );
    if (!episodeMatch) return undefined;

    const youtubeTranscript = await fetchYouTube(episodeMatch.videoUrl);
    if (!youtubeTranscript.rawTranscript.trim()) return undefined;

    const channelSourceId = sources.find((node) => node.platform_id === channelId)?.id;

    return {
      videoUrl: episodeMatch.videoUrl,
      rawTranscript: youtubeTranscript.rawTranscript,
      channelSourceId,
    };
  } catch {
    return undefined;
  }
}

async function createPodcastTranscriptNode(input: IngestionInput): Promise<IngestionResult> {
  const fetched = await fetchPodcastEpisode(input.url);
  const existingTranscript = await findExistingPodcastTranscript(fetched.episodeGuid);

  if (existingTranscript) {
    return existingTranscript;
  }

  const stages: ExtractionRunTrace['stages'] = [
    completedStage(
      'fetch:podcast',
      { url: input.url },
      {
        podcastTitle: fetched.podcastTitle,
        episodeTitle: fetched.episodeTitle,
        feedUrl: fetched.feedUrl,
        episodeGuid: fetched.episodeGuid,
        hasRssTranscript: Boolean(fetched.rssTranscriptUrl),
      },
    ),
  ];

  const sourceId = toNodeId(fetched.podcastTitle);

  let rawTranscript: string;
  let transcriptOrigin: 'rss' | 'youtube' | 'generated';
  let youtubeEpisode: Awaited<ReturnType<typeof tryYouTubeEpisodeTranscript>> | undefined;

  if (fetched.rssTranscriptUrl) {
    rawTranscript = await fetchRssTranscriptText(fetched.rssTranscriptUrl);
    transcriptOrigin = 'rss';
    stages.push(
      completedStage(
        'fetch:rss-transcript',
        { url: fetched.rssTranscriptUrl },
        { rawLength: rawTranscript.length },
      ),
    );
  } else {
    youtubeEpisode = await tryYouTubeEpisodeTranscript(sourceId, fetched);

    if (youtubeEpisode) {
      rawTranscript = youtubeEpisode.rawTranscript;
      transcriptOrigin = 'youtube';
      stages.push(
        completedStage(
          'fetch:youtube-episode',
          { videoUrl: youtubeEpisode.videoUrl },
          { rawLength: rawTranscript.length },
        ),
      );
    } else {
      const transcribed = await transcribeAudioLocally(fetched.audioUrl);
      rawTranscript = transcribed.plainText;
      transcriptOrigin = 'generated';
      stages.push(
        completedStage(
          'transcribe:mlx-whisper',
          { audioUrl: fetched.audioUrl },
          { plainTextLength: rawTranscript.length, segmentCount: transcribed.segments?.length },
        ),
      );
    }
  }

  let structuredContent: string;
  let plainTextForExtraction: string;
  let paragraphCount: number;
  let rawLength: number;
  let cleanLength: number;

  if (isSrtFormat(rawTranscript)) {
    const parsed = parseSrtTranscript(rawTranscript);
    structuredContent = parsed.structuredContent;
    plainTextForExtraction = applyKnownTranscriptReplacements(parsed.plainText);
    paragraphCount = parsed.paragraphCount;
    rawLength = parsed.rawLength;
    cleanLength = parsed.cleanLength;
  } else {
    const cleaned = cleanTranscript(rawTranscript);
    rawLength = cleaned.rawLength;

    const sanitizedText = applyKnownTranscriptReplacements(cleaned.cleanedText);
    cleanLength = sanitizedText.length;

    const structured = structureText(sanitizedText);
    structuredContent = structured.structuredContent;
    plainTextForExtraction = sanitizedText;
    paragraphCount = structured.paragraphCount;
  }

  stages.push(completedStage('structure:podcast-transcript', { rawLength }, { cleanLength, paragraphCount }));

  const { title: transcriptTitle, idWhenUntitled } = resolveYouTubeTranscriptTitle(
    input.title,
    fetched.episodeTitle,
  );
  const producedNodeIds = new Set<string>();
  const updatedAtIso = now();

  const transcriptBody = `${markdownH1Line(transcriptTitle)}\n\n${podcastTranscriptVisibleHeader(
    input.url,
    fetched.podcastTitle,
    updatedAtIso,
    fetched.publishedAt,
  )}\n\n${structuredContent}`;

  const transcriptResult = await createNode({
    type: 'transcript',
    ...(idWhenUntitled !== undefined ? { id: idWhenUntitled } : {}),
    title: transcriptTitle,
    body: transcriptBody,
    tags: [...new Set(['d:ingest', ...autoTag(transcriptTitle, ''), ...(input.tags ?? [])])],
    extra: {
      source_id: sourceId,
      source_item_id: fetched.episodeGuid,
      source_url: input.url,
      source_type: 'podcast' as TranscriptSourceType,
      ...(fetched.publishedAt ? { source_published_at: fetched.publishedAt } : {}),
      author: fetched.podcastTitle,
      raw_length: rawLength,
      clean_length: cleanLength,
      structured_paragraphs: paragraphCount,
      podcast_feed_url: fetched.feedUrl,
      podcast_episode_guid: fetched.episodeGuid,
      podcast_audio_url: fetched.audioUrl,
      transcript_origin: transcriptOrigin,
      ...(youtubeEpisode ? { youtube_video_url: youtubeEpisode.videoUrl } : {}),
      ...(youtubeEpisode?.channelSourceId
        ? { youtube_channel_source_id: youtubeEpisode.channelSourceId }
        : {}),
    },
  });
  producedNodeIds.add(transcriptResult.id);
  stages.push(
    completedStage(
      'store:transcript',
      { type: 'transcript', sourceId },
      { id: transcriptResult.id, path: transcriptResult.path },
    ),
  );

  try {
    const sourceResult = await createNode({
      type: 'source',
      title: fetched.podcastTitle,
      tags: [],
      extra: {
        source_kind: 'publication',
        url: fetched.feedUrl,
        platforms: fetched.showWebsite ? ['rss', 'website'] : ['rss'],
        profiles: [
          { platform: 'rss', url: fetched.feedUrl, label: fetched.podcastTitle, primary: true },
          ...(fetched.showWebsite ? [{ platform: 'website' as const, url: fetched.showWebsite }] : []),
        ],
        related: [transcriptResult.id],
      },
    });
    producedNodeIds.add(sourceId);
    stages.push(
      completedStage(
        'store:source',
        { id: sourceId },
        { id: sourceResult.id, path: sourceResult.path, reused: false },
      ),
    );
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes(sourceId)) {
      throw error;
    }

    stages.push(completedStage('store:source', { id: sourceId }, { id: sourceId, reused: true }));
  }

  return {
    id: transcriptResult.id,
    path: transcriptResult.path,
    type: 'transcript',
    title: transcriptTitle,
    sourceId,
    sourceItemId: fetched.episodeGuid,
    sourceUrl: input.url,
    author: fetched.podcastTitle,
    producedNodeIds: [...producedNodeIds],
    plainText: plainTextForExtraction,
    runTrace: { stages, decisions: [], llm: undefined },
  };
}

/** Source-neutral result of extracting knowledge from an already-saved node. */
export interface SavedNodeExtractionResult {
  nodeId: string;
  summary: string;
  ideaIds: string[];
  ideas: Array<{ id: string; title: string }>;
  llmMeta: {
    model: string;
    provider: string;
    durationMs: number;
    promptTokens?: number;
    completionTokens?: number;
  };
}

/** Transcript-shaped view of {@link SavedNodeExtractionResult}, kept for existing callers. */
export interface ExtractionResult extends SavedNodeExtractionResult {
  transcriptId: string;
}

/**
 * Run LLM knowledge extraction on an already-saved node — a transcript or an article resource.
 *
 * Updates the node's summary, tags, and LLM trace, then creates an IdeaNode per extracted idea and
 * writes their ids back. Safe to call after ingest: the source node is already persisted regardless
 * of outcome, so this stays best-effort.
 */
export async function extractKnowledgeFromNode(
  nodeId: string,
  nodePath: string,
  plainText: string,
  manualTags: string[] = [],
): Promise<SavedNodeExtractionResult> {
  const extracted = await llmExtractWithTrace(plainText);
  const normalizedLlmTags = normalizeContentTags(extracted.tags);
  let transcriptTags: string[] = [];

  await updateNode(nodePath, (node) => {
    transcriptTags = [
      ...new Set([
        ...(node.tags ?? []),
        ...manualTags,
        ...autoTag(node.title, plainText),
        ...normalizedLlmTags,
      ]),
    ];

    return {
      ...node,
      // Resources carry their summary in `description`; every other node type uses `summary`.
      // Writing the wrong key is silently dropped by the schema, so the branch is load-bearing.
      ...(node.type === 'resource' ? { description: extracted.summary } : { summary: extracted.summary }),
      tags: transcriptTags,
      llm_model: extracted.llmMeta.model,
      llm_provider: extracted.llmMeta.provider,
      llm_duration_ms: extracted.llmMeta.durationMs,
      llm_prompt_tokens: extracted.llmMeta.promptTokens,
      llm_completion_tokens: extracted.llmMeta.completionTokens,
    };
  });

  const transcriptDomainTags = normalizeDomainTags(transcriptTags);
  const ideas: Array<{ id: string; title: string }> = [];
  for (const [index, extractedIdea] of extracted.ideas.entries()) {
    const ideaDomainTags = extractedIdea.domainTags.filter((tag) => transcriptDomainTags.includes(tag));
    const inferredIdeaDomainTags = autoTag(extractedIdea.title, extractedIdea.tags.join(' '));
    const ideaInput = {
      type: 'idea' as const,
      title: extractedIdea.title,
      body: '',
      tags: [
        ...new Set([
          'd:ingest',
          ...manualTags,
          ...ideaDomainTags,
          ...inferredIdeaDomainTags,
          ...extractedIdea.tags,
        ]),
      ],
      extra: {
        origin: 'extracted',
        source_id: nodeId,
        related: [nodeId],
        llm_model: extracted.llmMeta.model,
        llm_provider: extracted.llmMeta.provider,
        llm_duration_ms: extracted.llmMeta.durationMs,
        llm_prompt_tokens: extracted.llmMeta.promptTokens,
        llm_completion_tokens: extracted.llmMeta.completionTokens,
      },
    };
    let createdIdea: Awaited<ReturnType<typeof createNode>>;
    try {
      createdIdea = await createNode(ideaInput);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('already exists')) {
        throw error;
      }

      createdIdea = await createNode({
        ...ideaInput,
        id: appendDatetimeFilenameSegment(
          `${toNodeId(extractedIdea.title)}-${toNodeId(extracted.llmMeta.model)}-${index + 1}`,
          new Date(),
        ),
      });
    }
    ideas.push({ id: createdIdea.id, title: extractedIdea.title });
  }

  const ideaIds = ideas.map((i) => i.id);

  await updateNode(nodePath, (node) => ({
    ...node,
    extracted_idea_ids: ideaIds,
    llm_model: extracted.llmMeta.model,
    llm_provider: extracted.llmMeta.provider,
    llm_duration_ms: extracted.llmMeta.durationMs,
    llm_prompt_tokens: extracted.llmMeta.promptTokens,
    llm_completion_tokens: extracted.llmMeta.completionTokens,
  }));

  return { nodeId, summary: extracted.summary, ideaIds, ideas, llmMeta: extracted.llmMeta };
}

/**
 * Transcript-named wrapper kept so YouTube and podcast callers are unaffected by the generalization.
 *
 * @deprecated Prefer {@link extractKnowledgeFromNode} for new callers.
 */
export async function extractKnowledgeFromTranscript(
  transcriptId: string,
  transcriptPath: string,
  plainText: string,
  manualTags: string[] = [],
): Promise<ExtractionResult> {
  const result = await extractKnowledgeFromNode(transcriptId, transcriptPath, plainText, manualTags);
  return { ...result, transcriptId: result.nodeId };
}

/** Adapts the save-first article pipeline onto the shared {@link IngestionResult} shape. */
async function createArticleNode(input: IngestionInput): Promise<IngestionResult> {
  const article = await createArticleNodes({
    url: input.url,
    ...(input.title ? { title: input.title } : {}),
    ...(input.tags ? { tags: input.tags } : {}),
  });

  return {
    id: article.id,
    path: article.path,
    type: 'resource',
    title: article.title,
    sourceId: article.sourceId,
    sourceUrl: article.sourceUrl,
    canonicalUrl: article.canonicalUrl,
    contentHash: article.contentHash,
    ...(article.author ? { author: article.author } : {}),
    producedNodeIds: article.producedNodeIds,
    reused: article.reused,
    plainText: article.plainText,
    runTrace: article.runTrace,
  };
}

export async function runIngestionPipeline(input: IngestionInput): Promise<IngestionResult> {
  if (input.sourceType === 'youtube') {
    return createTranscriptNode(input);
  }

  if (input.sourceType === 'podcast') {
    return createPodcastTranscriptNode(input);
  }

  if (input.sourceType === 'article') {
    return createArticleNode(input);
  }

  return createResourceNode(input, await fetchRepo(input.url), 'repo');
}
