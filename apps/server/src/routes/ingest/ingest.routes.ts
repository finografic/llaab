import { ingestArticle, ingestPodcast, ingestYouTube } from '@llaab/skills';
import type { AppCtxJson } from '../../types/app.types.js';
import type { IngestArticleBody, IngestPodcastBody, IngestYouTubeBody } from './ingest.schema.js';

export const youtube = {
  path: '/youtube' as const,
  handler: async (c: AppCtxJson<IngestYouTubeBody>) => {
    const body = c.req.valid('json');
    const { record, result, extraction, extractionError } = await ingestYouTube({
      url: body.url,
      title: body.title,
      tags: body.tags,
      skipExtraction: body.skipExtraction,
    });

    if (record.status === 'failed') {
      return c.json({ success: false as const, error: record.error ?? 'Ingestion failed.' }, 500);
    }

    return c.json({
      success: true as const,
      result: {
        id: result.id,
        path: result.path,
        type: result.type,
        reused: result.reused ?? false,
      },
      extraction: extraction
        ? { ideaCount: extraction.ideaIds.length, summary: extraction.summary, ideas: extraction.ideas }
        : null,
      extractionError: extractionError ?? null,
    });
  },
};

export const article = {
  path: '/article' as const,
  handler: async (c: AppCtxJson<IngestArticleBody>) => {
    const body = c.req.valid('json');
    const { record, result, extraction, extractionError } = await ingestArticle({
      url: body.url,
      title: body.title,
      tags: body.tags,
      skipExtraction: body.skipExtraction,
      inboxCaptureId: body.inboxCaptureId,
    });

    if (record.status === 'failed') {
      return c.json({ success: false as const, error: record.error ?? 'Ingestion failed.' }, 500);
    }

    return c.json({
      success: true as const,
      result: {
        id: result.id,
        path: result.path,
        type: result.type,
        title: result.title,
        canonicalUrl: result.canonicalUrl,
        sourceId: result.sourceId,
        reused: result.reused,
      },
      extraction: extraction
        ? { ideaCount: extraction.ideaIds.length, summary: extraction.summary, ideas: extraction.ideas }
        : null,
      extractionError: extractionError ?? null,
    });
  },
};

export const podcast = {
  path: '/podcast' as const,
  handler: async (c: AppCtxJson<IngestPodcastBody>) => {
    const body = c.req.valid('json');
    const { record, result, extraction, extractionError } = await ingestPodcast({
      url: body.url,
      title: body.title,
      tags: body.tags,
      skipExtraction: body.skipExtraction,
    });

    if (record.status === 'failed') {
      return c.json({ success: false as const, error: record.error ?? 'Ingestion failed.' }, 500);
    }

    return c.json({
      success: true as const,
      result: {
        id: result.id,
        path: result.path,
        type: result.type,
        reused: result.reused ?? false,
      },
      extraction: extraction
        ? { ideaCount: extraction.ideaIds.length, summary: extraction.summary, ideas: extraction.ideas }
        : null,
      extractionError: extractionError ?? null,
    });
  },
};
