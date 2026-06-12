import { getCookie } from 'hono/cookie';
import type { AppEnv } from '../types/app.types.js';
import type { Context } from 'hono';

export const VAULT_COOKIE_NAME = 'vault_key';
export const VAULT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function getVaultPassword(): string {
  return process.env['VAULT_PASSWORD'] ?? 'llaab';
}

export function isVaultSessionValid(c: Context<AppEnv>): boolean {
  const cookie = getCookie(c, VAULT_COOKIE_NAME);
  return cookie === getVaultPassword();
}
