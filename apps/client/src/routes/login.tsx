import { Button } from 'components/ui/button';
import { Input } from 'components/ui/input';
import { useState } from 'react';
import { redirect, useNavigate } from 'react-router-dom';
import type { FormEvent } from 'react';

import { buildApiHeaders } from 'lib/api-client';
import { appLoginLoader as loadAppLoginLoader } from 'lib/auth-session';
import { usePageTitle } from 'lib/use-page-title';

import styles from './login.module.css';

export async function vaultLoginLoader() {
  const res = await fetch('/api/vault/auth/session', {
    credentials: 'include',
    headers: buildApiHeaders(),
  });

  if (!res.ok) {
    return null;
  }

  const body = (await res.json()) as { authRequired?: boolean };
  if (body.authRequired === false) {
    throw redirect('/vault');
  }

  return null;
}

export function VaultLoginPage() {
  usePageTitle('Vault');
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [hasError, setHasError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setHasError(false);

    try {
      const res = await fetch('/api/vault/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: buildApiHeaders(),
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        setHasError(true);
        return;
      }

      void navigate('/vault', { replace: true });
    } catch {
      setHasError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.pageWrap}>
      <main>
        <p className="eyebrow">LLAAB</p>
        <h1>Vault</h1>

        <div className={styles.card}>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Password
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  placeholder="Enter vault password"
                  className="font-mono text-sm"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Unlocking…' : 'Unlock'}
                </Button>
              </div>
              {hasError ? <span className="text-sm text-destructive">Incorrect password.</span> : null}
            </div>
          </form>

          <p className={styles.hint}>
            Set <code>VAULT_PASSWORD</code> in <code>.env</code> to require a vault login. Leave it unset for
            open local access.
          </p>
        </div>
      </main>
    </div>
  );
}

export const appLoginLoader = loadAppLoginLoader;

export function AppLoginPage() {
  usePageTitle('Login');
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [hasError, setHasError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setHasError(false);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: buildApiHeaders(),
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        setHasError(true);
        return;
      }

      void navigate('/', { replace: true });
    } catch {
      setHasError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.pageWrap}>
      <main>
        <p className="eyebrow">LLAAB</p>
        <h1>Login</h1>

        <div className={styles.card}>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="app-password"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Password
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="app-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  placeholder="Enter app password"
                  className="font-mono text-sm"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Signing in…' : 'Sign in'}
                </Button>
              </div>
              {hasError ? <span className="text-sm text-destructive">Incorrect password.</span> : null}
            </div>
          </form>

          <p className={styles.hint}>
            Set <code>LLAAB_PASSWORD</code> in <code>.env</code> to require browser login for app writes. API
            clients can use <code>LLAAB_API_KEY</code>.
          </p>
        </div>
      </main>
    </div>
  );
}
