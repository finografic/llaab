import { Outlet, redirect } from 'react-router-dom';

import { checkVaultSession } from 'lib/vault-session';

export async function vaultSessionLoader() {
  const ok = await checkVaultSession();
  if (!ok) {
    throw redirect('/vault/login');
  }
  return null;
}

export function VaultLayout() {
  return <Outlet />;
}
