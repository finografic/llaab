import { createRouter } from '../../lib/create-app.js';
import * as routes from './crons.routes.js';

export const cronsRouter = createRouter()
  .get(routes.list.path, routes.list.handler)
  .post(routes.run.path, routes.run.handler);
