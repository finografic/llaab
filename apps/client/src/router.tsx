import { AppLayout } from 'layouts/AppLayout/AppLayout';
import { createBrowserRouter } from 'react-router-dom';
import { VaultLoginPage } from 'routes/login';
import { HomePage } from 'routes/root';
import { VaultIndexPage } from 'routes/vault-index';
import { VaultLayout, vaultSessionLoader } from 'routes/vault-layout';
import type { RouteHandle } from 'layouts/AppLayout/AppLayout';

export const router = createBrowserRouter([
  {
    path: '/vault/login',
    element: <VaultLoginPage />,
  },
  {
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
        handle: { title: 'Home' } satisfies RouteHandle,
      },
      {
        path: 'vault',
        loader: vaultSessionLoader,
        element: <VaultLayout />,
        children: [
          {
            index: true,
            element: <VaultIndexPage />,
            handle: { title: 'Vault' } satisfies RouteHandle,
          },
        ],
      },
    ],
  },
]);
