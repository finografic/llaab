import { getCookie } from 'hono/cookie';
import type { AppEnv } from '../types/app.types.js';
import type { Context } from 'hono';

export const VAULT_COOKIE_NAME = 'vault_key';
export const VAULT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** Vault UI login is off when `VAULT_PASSWORD` is unset or empty. */
export function isVaultAuthEnabled(): boolean {
  const password = process.env['VAULT_PASSWORD'];
  return password !== undefined && password !== '';
}

export function getVaultPassword(): string | null {
  if (!isVaultAuthEnabled()) {
    return null;
  }

  return process.env['VAULT_PASSWORD'] ?? null;
}

export function isVaultSessionValid(c: Context<AppEnv>): boolean {
  if (!isVaultAuthEnabled()) {
    return true;
  }

  const expected = getVaultPassword();
  if (expected === null) {
    return true;
  }

  const cookie = getCookie(c, VAULT_COOKIE_NAME);
  return cookie === expected;
}
