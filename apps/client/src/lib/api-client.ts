/**
 * Thin fetch wrapper for @llaab/server.
 *
 * In dev, Vite proxies /api/* → SERVER_URL (apps/server). The client always fetches relative paths so no
 * cross-origin setup is needed in the browser.
 *
 * | Config       | Default (dev)             | Override via           |
 * | ------------ | ------------------------- | ---------------------- |
 * | Proxy target | http://localhost:3000     | SERVER_URL env var     |
 * | Auth header  | (none — key not required) | SERVER_API_KEY env var |
 */

const API_KEY: string | undefined = import.meta.env['SERVER_API_KEY'] as string | undefined;

function buildHeaders(): Headers {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  if (API_KEY) headers.set('X-API-Key', API_KEY);
  return headers;
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(path, {
    headers: buildHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `GET ${path} failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as { error?: string }).error ?? `POST ${path} failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}
