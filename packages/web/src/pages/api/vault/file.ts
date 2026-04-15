import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { VAULT_ROOT } from '@llaab/core';
import type { APIRoute } from 'astro';

export const prerender = false;
const COOKIE_NAME = 'vault_key';

function isAuthenticated(cookies: Parameters<APIRoute>[0]['cookies']): boolean {
  const cookie = cookies.get(COOKIE_NAME);
  const password = import.meta.env.VAULT_PASSWORD ?? 'llaab';
  return cookie?.value === password;
}

/** GET /api/vault/file?path=<relative-path> — return raw file content. */
export const GET: APIRoute = async ({ url, cookies }) => {
  if (!isAuthenticated(cookies)) {
    return json({ error: 'Unauthorized.' }, 401);
  }

  const filePath = url.searchParams.get('path');

  if (!filePath) {
    return json({ error: '`path` query parameter is required.' }, 400);
  }

  // Prevent path traversal — resolved path must stay within vault root.
  const resolved = path.resolve(VAULT_ROOT, filePath);
  if (!resolved.startsWith(VAULT_ROOT + path.sep) && resolved !== VAULT_ROOT) {
    return json({ error: 'Invalid path.' }, 403);
  }

  try {
    const content = await readFile(resolved, 'utf-8');
    return json({ content });
  } catch {
    return json({ error: 'File not found.' }, 404);
  }
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
