import { zValidator } from '@hono/zod-validator';

import { createRouter } from '../../lib/create-app.js';
import { handleIngestYouTube } from './ingest.handlers.js';
import { ingestYouTubeBodySchema } from './ingest.routes.js';

const router = createRouter();

router.post('/youtube', zValidator('json', ingestYouTubeBodySchema), handleIngestYouTube);

export { router as ingestRouter };
