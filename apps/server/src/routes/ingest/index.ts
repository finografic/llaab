import { zValidator } from '@hono/zod-validator';

import { createRouter } from '../../lib/create-app.js';
import * as routes from './ingest.routes.js';
import { ingestPodcastBodySchema, ingestYouTubeBodySchema } from './ingest.schema.js';

export const ingestRouter = createRouter()
  .post(routes.youtube.path, zValidator('json', ingestYouTubeBodySchema), routes.youtube.handler)
  .post(routes.podcast.path, zValidator('json', ingestPodcastBodySchema), routes.podcast.handler);
