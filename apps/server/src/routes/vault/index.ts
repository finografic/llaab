import { zValidator } from '@hono/zod-validator';

import { createRouter } from '../../lib/create-app.js';
import { handleGetNode, handleGetNodeRaw, handleListNodes } from './vault.handlers.js';
import { listNodesQuerySchema } from './vault.routes.js';

const router = createRouter();

router.get('/nodes', zValidator('query', listNodesQuerySchema), handleListNodes);
router.get('/nodes/:id', handleGetNode);
router.get('/nodes/:id/raw', handleGetNodeRaw);

export { router as vaultRouter };
