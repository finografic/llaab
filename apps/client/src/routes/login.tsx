import { Button } from 'components/ui/button';
import { Input } from 'components/ui/input';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { buildApiHeaders } from 'lib/api-client';
import { usePageTitle } from 'lib/use-page-title';

import styles from './login.module.css';

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
            Default password is <code>llaab</code>. Override with <code>VAULT_PASSWORD</code> in{' '}
            <code>.env</code>.
          </p>
        </div>
      </main>
    </div>
  );
}
