import { zValidator } from '@hono/zod-validator';
import { ingestYouTube } from '@llaab/skills';

import { createRouter } from '../../lib/create-app.js';
import { ingestYouTubeBodySchema } from './ingest.routes.js';

export const ingestRouter = createRouter().post(
  '/youtube',
  zValidator('json', ingestYouTubeBodySchema),
  async (c) => {
    const body = c.req.valid('json');
    const { record, result } = await ingestYouTube({
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
    });
  },
);
