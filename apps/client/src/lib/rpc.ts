/**
 * Hono RPC client — typed end-to-end from server route definitions.
 *
 * Use `rpc` in React components instead of the raw `apiGet` / `apiPost` helpers. TypeScript infers
 * request/response shapes automatically from the server's AppType.
 *
 * Usage: const res = await rpc.api.vault.nodes.$get({ query: { type: 'idea' } }); const { nodes } = await
 * res.json(); // typed as { nodes: LabNode[] }
 *
 * Const res = await rpc.api.vault.nodes.$post({ json: { type: 'idea', title: 'My Idea' } }); const data =
 * await res.json(); // typed as { id, path, type } | { error }
 *
 * In dev, Vite proxies /api/* → localhost:3000 (apps/server). The base URL is the Astro dev-server origin so
 * requests stay same-origin and the proxy fires correctly.
 */

import { hc } from 'hono/client';
import type { AppType } from '../../../server/src/app.js';

const API_KEY: string | undefined = import.meta.env['SERVER_API_KEY'] as string | undefined;

const baseUrl = globalThis.window?.location.origin ?? 'http://localhost:4321';

export const rpc = hc<AppType>(baseUrl, {
  headers: () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (API_KEY) headers['X-API-Key'] = API_KEY;
    return headers;
  },
});
