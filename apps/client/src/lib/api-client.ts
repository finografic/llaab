/**
 * Thin fetch wrapper for @llaab/server.
 *
 * In dev, Vite proxies /api/* → `LLAAB_API_URL` (apps/server). The client always fetches relative paths so no
 * cross-origin setup is needed in the browser.
 */

export function buildApiHeaders(): Headers {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  return headers;
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: buildApiHeaders(),
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
    credentials: 'include',
    headers: buildApiHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as { error?: string }).error ?? `POST ${path} failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}
