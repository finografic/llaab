/**
 * Hono RPC client — typed end-to-end from server route definitions.
 *
 * Usage: const res = await api.vault.nodes.$get({ query: { type: 'idea' } }); const { nodes } = await
 * res.json(); // typed as { nodes: LabNode[] }
 *
 * In dev, Vite proxies /api/* → localhost:3000 (apps/server). The base URL is the Astro dev-server origin so
 * requests stay same-origin and the proxy fires correctly.
 */

import { hc } from 'hono/client';
import type { AppType } from '../../../server/src/app.js';

const API_KEY: string | undefined = import.meta.env['SERVER_API_KEY'] as string | undefined;

const baseUrl = globalThis.window?.location.origin ?? 'http://localhost:4321';

const client = hc<AppType>(baseUrl, {
  headers: () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (API_KEY) headers['X-API-Key'] = API_KEY;
    return headers;
  },
});

/** Typed API client. Mirrors the server's /api/* route tree. */
export const api = client.api;

/** DELETE /api/vault/runs/:id — optional produced-node cascade. */
export async function deleteVaultRun(id: string, deleteProduced: boolean) {
  return api.vault.runs[':id'].$delete({
    param: { id },
    query: { deleteProduced: deleteProduced ? 'true' : 'false' },
  } as { param: { id: string } });
}
