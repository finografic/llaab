import { redirect } from 'react-router-dom';

import { buildApiHeaders } from 'lib/api-client';

interface AuthSessionResponse {
  authenticated: boolean;
  authRequired: boolean;
}

export async function readAuthSession(): Promise<AuthSessionResponse> {
  const res = await fetch('/api/auth/session', {
    credentials: 'include',
    headers: buildApiHeaders(),
  });

  if (!res.ok) {
    return { authenticated: false, authRequired: true };
  }

  return res.json() as Promise<AuthSessionResponse>;
}

export async function appSessionLoader() {
  const session = await readAuthSession();
  if (session.authRequired && !session.authenticated) {
    throw redirect('/login');
  }
  return null;
}

export async function appLoginLoader() {
  const session = await readAuthSession();
  if (!session.authRequired || session.authenticated) {
    throw redirect('/');
  }
  return null;
}
