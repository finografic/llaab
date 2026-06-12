import { createRouter } from '../../lib/create-app.js';
import * as routes from './runs.routes.js';

export const runsRouter = createRouter()
  .get(routes.list.path, routes.list.handler)
  .get(routes.monitor.path, routes.monitor.handler)
  .get(routes.detail.path, routes.detail.handler)
  .post(routes.retry.path, routes.retry.handler);
