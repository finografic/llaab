import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Anchor to this file's own location so VAULT_ROOT is correct regardless of
// process.cwd(). Works whether executed from source (src/utils/) or compiled
// output (dist/utils/) — both sit 4 levels below the monorepo root.
const _dir = dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = resolve(_dir, '../../../..');

/**
 * Absolute path to the vault directory.
 *
 * Resolved relative to the monorepo root, not `process.cwd()`. This means it is correct regardless of where
 * the process is started — CLI, web server, or test runner.
 *
 * Override with the `LLAAB_VAULT` env var for non-standard layouts.
 */
export const VAULT_ROOT: string = process.env.LLAAB_VAULT
  ? resolve(process.env.LLAAB_VAULT)
  : resolve(MONOREPO_ROOT, 'vault');
