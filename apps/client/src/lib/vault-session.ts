import { buildApiHeaders } from 'lib/api-client';

/** Returns whether the browser has a valid vault session cookie. */
export async function checkVaultSession(): Promise<boolean> {
  const res = await fetch('/api/vault/auth/session', {
    credentials: 'include',
    headers: buildApiHeaders(),
  });
  return res.ok;
}
