import { ingestYouTube } from '@llaab/skills';
import { StatusCodes } from 'http-status-codes';
import type { IngestYouTubeBody } from './ingest.routes.js';
import type { Context } from 'hono';

export async function handleIngestYouTube(c: Context) {
  const body = c.req.valid('json' as never) as IngestYouTubeBody;

  const { record, result } = await ingestYouTube({
    url: body.url,
    title: body.title,
    tags: body.tags,
  });

  if (record.status === 'failed') {
    return c.json(
      { success: false, error: record.error ?? 'Ingestion failed.' },
      StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }

  const reused = result.runTrace?.stages.some((s) => s.name === 'dedupe:transcript') ?? false;

  return c.json({
    success: true,
    result: {
      id: result.id,
      path: result.path,
      type: result.type,
      reused,
    },
  });
}
