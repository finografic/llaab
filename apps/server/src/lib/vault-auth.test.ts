import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { getVaultPassword, isVaultAuthEnabled, isVaultSessionValid } from './vault-auth.js';

describe('vault-auth', () => {
  const originalPassword = process.env['VAULT_PASSWORD'];

  beforeEach(() => {
    delete process.env['VAULT_PASSWORD'];
  });

  afterEach(() => {
    if (originalPassword === undefined) {
      delete process.env['VAULT_PASSWORD'];
    } else {
      process.env['VAULT_PASSWORD'] = originalPassword;
    }
  });

  it('treats unset VAULT_PASSWORD as auth disabled', () => {
    expect(isVaultAuthEnabled()).toBe(false);
    expect(getVaultPassword()).toBeNull();
  });

  it('treats empty VAULT_PASSWORD as auth disabled', () => {
    process.env['VAULT_PASSWORD'] = '';
    expect(isVaultAuthEnabled()).toBe(false);
    expect(getVaultPassword()).toBeNull();
  });

  it('requires a password when VAULT_PASSWORD is set', () => {
    process.env['VAULT_PASSWORD'] = 'secret';
    expect(isVaultAuthEnabled()).toBe(true);
    expect(getVaultPassword()).toBe('secret');
  });

  it('accepts any session when auth is disabled', () => {
    expect(isVaultSessionValid({} as never)).toBe(true);
  });
});
