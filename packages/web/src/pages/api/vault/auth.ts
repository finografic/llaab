import type { APIRoute } from 'astro';

export const prerender = false;

const COOKIE_NAME = 'vault_key';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getPassword(): string {
  return import.meta.env.VAULT_PASSWORD ?? 'llaab';
}

/** POST /api/vault/auth — validate password and set session cookie. */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const password = form.get('password');

  if (typeof password !== 'string' || password !== getPassword()) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/vault/login?error=1' },
    });
  }

  cookies.set(COOKIE_NAME, getPassword(), {
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
  });

  return redirect('/vault', 302);
};

/** GET /api/vault/logout — clear session cookie and redirect to login. */
export const GET: APIRoute = ({ cookies, redirect }) => {
  cookies.delete(COOKIE_NAME, { path: '/' });
  return redirect('/vault/login', 302);
};
