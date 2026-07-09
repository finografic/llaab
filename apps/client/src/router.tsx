import { AppLayout } from 'layouts/AppLayout/AppLayout';
import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { appLoginLoader, AppLoginPage, VaultLoginPage, vaultLoginLoader } from 'routes/login';
import { VaultLayout, vaultSessionLoader } from 'routes/vault-layout';
import type { RouteHandle } from 'layouts/AppLayout/AppLayout';
import type { ComponentType, ReactElement } from 'react';

import { appSessionLoader } from 'lib/auth-session';

const HomePage = lazy(() => import('routes/root').then((module) => ({ default: module.HomePage })));
const IngestPage = lazy(() => import('routes/ingest').then((module) => ({ default: module.IngestPage })));
const TerminalPage = lazy(() =>
  import('routes/terminal').then((module) => ({ default: module.TerminalPage })),
);
const HermesPage = lazy(() => import('routes/hermes').then((module) => ({ default: module.HermesPage })));
const CronsPage = lazy(() => import('routes/crons').then((module) => ({ default: module.CronsPage })));
const LlmPage = lazy(() => import('routes/llm').then((module) => ({ default: module.LlmPage })));
const DevIconsPage = lazy(() =>
  import('routes/dev-icons').then((module) => ({ default: module.DevIconsPage })),
);
const VaultBrowsePage = lazy(() =>
  import('routes/vault-browse').then((module) => ({ default: module.VaultBrowsePage })),
);
const SourcesPage = lazy(() => import('routes/sources').then((module) => ({ default: module.SourcesPage })));
const SourceDetailPage = lazy(() =>
  import('routes/source-detail').then((module) => ({ default: module.SourceDetailPage })),
);
const RunsPage = lazy(() => import('routes/runs').then((module) => ({ default: module.RunsPage })));
const RunDetailPage = lazy(() =>
  import('routes/run-detail').then((module) => ({ default: module.RunDetailPage })),
);
const NodesPage = lazy(() => import('routes/nodes').then((module) => ({ default: module.NodesPage })));
const NodeDetailPage = lazy(() =>
  import('routes/node-detail').then((module) => ({ default: module.NodeDetailPage })),
);
const TranscriptsPage = lazy(() =>
  import('routes/transcripts').then((module) => ({ default: module.TranscriptsPage })),
);
const TranscriptDetailPage = lazy(() =>
  import('routes/transcript-detail').then((module) => ({ default: module.TranscriptDetailPage })),
);
const InboxPage = lazy(() => import('routes/inbox').then((module) => ({ default: module.InboxPage })));
const InboxDetailPage = lazy(() =>
  import('routes/inbox-detail').then((module) => ({ default: module.InboxDetailPage })),
);
const RegistrySearchPage = lazy(() =>
  import('routes/registry-search').then((module) => ({ default: module.RegistrySearchPage })),
);
const RegistryPackagePage = lazy(() =>
  import('routes/registry-package').then((module) => ({ default: module.RegistryPackagePage })),
);
const RegistryPinnedPage = lazy(() =>
  import('routes/registry-pinned').then((module) => ({ default: module.RegistryPinnedPage })),
);

function lazyElement(Component: ComponentType): ReactElement {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading…</p>}>
      <Component />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: '/login',
    loader: appLoginLoader,
    element: <AppLoginPage />,
  },
  {
    path: '/vault/login',
    loader: vaultLoginLoader,
    element: <VaultLoginPage />,
  },
  {
    loader: appSessionLoader,
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: lazyElement(HomePage),
        handle: { title: 'Home' } satisfies RouteHandle,
      },
      {
        path: 'registry',
        element: lazyElement(RegistrySearchPage),
        handle: { title: 'Library Registry' } satisfies RouteHandle,
      },
      {
        path: 'registry/pinned',
        element: lazyElement(RegistryPinnedPage),
        handle: { title: 'Pinned Libraries' } satisfies RouteHandle,
      },
      {
        path: 'registry/package/:name',
        element: lazyElement(RegistryPackagePage),
        handle: { title: 'Package' } satisfies RouteHandle,
      },
      {
        path: 'ingest',
        element: lazyElement(IngestPage),
        handle: { title: 'Ingest' } satisfies RouteHandle,
      },
      {
        path: 'terminal',
        element: lazyElement(TerminalPage),
        handle: { title: 'Terminal' } satisfies RouteHandle,
      },
      {
        path: 'hermes',
        element: lazyElement(HermesPage),
        handle: { title: 'Hermes / MCP' } satisfies RouteHandle,
      },
      {
        path: 'crons',
        element: lazyElement(CronsPage),
        handle: { title: 'Crons' } satisfies RouteHandle,
      },
      {
        path: 'llm',
        element: lazyElement(LlmPage),
        handle: { title: 'LLM Status' } satisfies RouteHandle,
      },
      {
        path: 'icons',
        element: <Navigate to="/dev/icons" replace />,
      },
      {
        path: 'dev/icons',
        element: lazyElement(DevIconsPage),
        handle: { title: 'Dev · Icons' } satisfies RouteHandle,
      },
      {
        path: 'vault',
        loader: vaultSessionLoader,
        // The session check has no dependency on path/search params — without this, React
        // Router re-runs it (a network fetch) on every click inside the Vault Explorer or Vault
        // Changes panel, since both drive navigation via `?path=` search params. A single flaky
        // fetch then crashes the whole route. Only re-check when the pathname itself changes.
        shouldRevalidate: ({ currentUrl, nextUrl }) => currentUrl.pathname !== nextUrl.pathname,
        element: <VaultLayout />,
        children: [
          {
            index: true,
            element: lazyElement(VaultBrowsePage),
            handle: { title: 'Vault' } satisfies RouteHandle,
          },
          {
            path: 'sources',
            element: lazyElement(SourcesPage),
            handle: { title: 'Sources' } satisfies RouteHandle,
          },
          {
            path: 'sources/:id',
            element: lazyElement(SourceDetailPage),
            handle: { title: 'Source' } satisfies RouteHandle,
          },
          {
            path: 'runs',
            element: lazyElement(RunsPage),
            handle: { title: 'Runs' } satisfies RouteHandle,
          },
          {
            path: 'runs/:id',
            element: lazyElement(RunDetailPage),
            handle: { title: 'Run' } satisfies RouteHandle,
          },
          {
            path: 'nodes',
            element: lazyElement(NodesPage),
            handle: { title: 'Nodes' } satisfies RouteHandle,
          },
          {
            path: 'nodes/:id',
            element: lazyElement(NodeDetailPage),
            handle: { title: 'Node' } satisfies RouteHandle,
          },
          {
            path: 'inbox',
            element: lazyElement(InboxPage),
            handle: { title: 'Inbox' } satisfies RouteHandle,
          },
          {
            path: 'inbox/:id',
            element: lazyElement(InboxDetailPage),
            handle: { title: 'Inbox capture' } satisfies RouteHandle,
          },
          {
            path: 'transcripts',
            element: lazyElement(TranscriptsPage),
            handle: { title: 'Transcripts', fullBleed: true } satisfies RouteHandle,
          },
          {
            path: 'transcripts/:id',
            element: lazyElement(TranscriptDetailPage),
            handle: { title: 'Transcript', fullBleed: true } satisfies RouteHandle,
          },
        ],
      },
    ],
  },
]);
