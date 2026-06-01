import type { APIRoute } from 'astro';

export const prerender = false;

const COOKIE_NAME = 'vault_key';

/** GET /api/vault/auth — clear session cookie (logout) and redirect to login. */
export const GET: APIRoute = ({ cookies, redirect }) => {
  cookies.delete(COOKIE_NAME, { path: '/' });
  return redirect('/vault/login', 302);
};
