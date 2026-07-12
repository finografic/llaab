import { resolve } from 'node:path';

import { MONOREPO_ROOT } from './vault-root.js';

/** Absolute path to promoted knowledge, separate from the nested runtime vault. */
export const KNOWLEDGE_ROOT: string = process.env.LLAAB_KNOWLEDGE
  ? resolve(process.env.LLAAB_KNOWLEDGE)
  : resolve(MONOREPO_ROOT, 'knowledge');
