import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { VAULT_ROOT } from '@llaab/core';
import { StatusCodes } from 'http-status-codes';
import type { Context } from 'hono';

/**
 * GET /api/vault/file?path=<relative-path>
 *
 * Returns the raw markdown content of a vault file. Path must be relative to VAULT_ROOT — requests that
 * resolve outside the vault are rejected.
 */
export async function handleGetVaultFile(c: Context) {
  const filePath = c.req.query('path');

  if (!filePath) {
    return c.json({ error: '`path` query parameter is required.' }, StatusCodes.BAD_REQUEST);
  }

  const resolved = path.resolve(VAULT_ROOT, filePath);

  if (!resolved.startsWith(VAULT_ROOT + path.sep) && resolved !== VAULT_ROOT) {
    return c.json({ error: 'Invalid path.' }, StatusCodes.FORBIDDEN);
  }

  try {
    const content = await readFile(resolved, 'utf-8');
    return c.json({ content });
  } catch {
    return c.json({ error: 'File not found.' }, StatusCodes.NOT_FOUND);
  }
}
