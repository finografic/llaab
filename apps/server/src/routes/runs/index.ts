import { createRouter } from '../../lib/create-app.js';
import { handleGetRun, handleListRuns } from './runs.handlers.js';

const router = createRouter();

router.get('/', handleListRuns);
router.get('/:id', handleGetRun);

export { router as runsRouter };
