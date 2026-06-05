import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { VAULT_ROOT } from '@llaab/core';
import type { APIRoute } from 'astro';

export const prerender = false;

const COOKIE_NAME = 'vault_key';

export const GET: APIRoute = async ({ request, cookies }) => {
  const password = import.meta.env.VAULT_PASSWORD ?? 'llaab';
  const cookie = cookies.get(COOKIE_NAME);

  if (cookie?.value !== password) {
    return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const filePath = url.searchParams.get('path');

  if (!filePath) {
    return new Response(JSON.stringify({ error: '`path` query parameter is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const resolved = resolve(VAULT_ROOT, filePath);
  if (!resolved.startsWith(VAULT_ROOT + sep) && resolved !== VAULT_ROOT) {
    return new Response(JSON.stringify({ error: 'Invalid path.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const content = await readFile(resolved, 'utf-8');
    return new Response(JSON.stringify({ content }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'File not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
