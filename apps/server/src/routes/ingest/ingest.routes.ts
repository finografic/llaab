import { ingestPodcast, ingestYouTube } from '@llaab/skills';
import type { AppCtxJson } from '../../types/app.types.js';
import type { IngestPodcastBody, IngestYouTubeBody } from './ingest.schema.js';

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
      extraction: extraction ? { ideaCount: extraction.ideaIds.length, summary: extraction.summary } : null,
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
      extraction: extraction ? { ideaCount: extraction.ideaIds.length, summary: extraction.summary } : null,
      extractionError: extractionError ?? null,
    });
  },
};
