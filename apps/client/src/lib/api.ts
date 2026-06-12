/**
 * Hono RPC client — typed end-to-end from server route definitions.
 *
 * Usage: const res = await api.vault.nodes.$get({ query: { type: 'idea' } }); const { nodes } = await
 * res.json(); // typed as { nodes: LabNode[] }
 *
 * In dev, Vite proxies /api/* → apps/server. Requests stay same-origin so the proxy fires correctly.
 */

import { hc } from 'hono/client';
import type { AppType } from '../../../server/src/app.js';

const baseUrl = globalThis.window?.location.origin ?? 'http://localhost:3000';

const client = hc<AppType>(baseUrl, {
  fetch: (input: RequestInfo | URL, init?: RequestInit) =>
    fetch(input, {
      ...init,
      credentials: 'include',
    }),
  headers: () => ({ 'Content-Type': 'application/json' }),
});

/** Typed API client. Mirrors the server's /api/* route tree. */
export const { api } = client;

/** DELETE /api/vault/runs/:id — optional produced-node cascade. */
export async function deleteVaultRun(id: string, deleteProduced: boolean) {
  return api.vault.runs[':id'].$delete({
    param: { id },
    query: { deleteProduced: deleteProduced ? 'true' : 'false' },
  } as { param: { id: string } });
}
