import { ingestYouTube } from '@llaab/skills';
import type { AppCtxJson } from '../../types/app.types.js';
import type { IngestYouTubeBody } from './ingest.schema.js';

export const youtube = {
  path: '/youtube' as const,
  handler: async (c: AppCtxJson<IngestYouTubeBody>) => {
    const body = c.req.valid('json');
    const { record, result, extraction, extractionError } = await ingestYouTube({
      url: body.url,
      title: body.title,
      tags: body.tags,
    });

    if (record.status === 'failed') {
      return c.json({ success: false as const, error: record.error ?? 'Ingestion failed.' }, 500);
    }

    const reused = result.runTrace?.stages.some((s) => s.name === 'dedupe:transcript') ?? false;
    return c.json({
      success: true as const,
      result: {
        id: result.id,
        path: result.path,
        type: result.type,
        reused,
      },
      extraction: extraction ? { ideaCount: extraction.ideaIds.length, summary: extraction.summary } : null,
      extractionError: extractionError ?? null,
    });
  },
};
