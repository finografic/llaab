import { AppLayout } from 'layouts/AppLayout/AppLayout';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { DevIconsPage } from 'routes/dev-icons';
import { IngestPage } from 'routes/ingest';
import { LlmPage } from 'routes/llm';
import { VaultLoginPage } from 'routes/login';
import { NodeDetailPage } from 'routes/node-detail';
import { NodesPage } from 'routes/nodes';
import { HomePage } from 'routes/root';
import { RunDetailPage } from 'routes/run-detail';
import { RunsPage } from 'routes/runs';
import { SourceDetailPage } from 'routes/source-detail';
import { SourcesPage } from 'routes/sources';
import { TerminalPage } from 'routes/terminal';
import { TranscriptDetailPage } from 'routes/transcript-detail';
import { TranscriptsPage } from 'routes/transcripts';
import { VaultBrowsePage } from 'routes/vault-browse';
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
        path: 'ingest',
        element: <IngestPage />,
        handle: { title: 'Ingest' } satisfies RouteHandle,
      },
      {
        path: 'terminal',
        element: <TerminalPage />,
        handle: { title: 'Terminal' } satisfies RouteHandle,
      },
      {
        path: 'llm',
        element: <LlmPage />,
        handle: { title: 'LLM Status' } satisfies RouteHandle,
      },
      {
        path: 'icons',
        element: <Navigate to="/dev/icons" replace />,
      },
      {
        path: 'dev/icons',
        element: <DevIconsPage />,
        handle: { title: 'Dev · Icons' } satisfies RouteHandle,
      },
      {
        path: 'vault',
        loader: vaultSessionLoader,
        element: <VaultLayout />,
        children: [
          {
            index: true,
            element: <VaultBrowsePage />,
            handle: { title: 'Vault' } satisfies RouteHandle,
          },
          {
            path: 'sources',
            element: <SourcesPage />,
            handle: { title: 'Sources' } satisfies RouteHandle,
          },
          {
            path: 'sources/:id',
            element: <SourceDetailPage />,
            handle: { title: 'Source' } satisfies RouteHandle,
          },
          {
            path: 'runs',
            element: <RunsPage />,
            handle: { title: 'Runs' } satisfies RouteHandle,
          },
          {
            path: 'runs/:id',
            element: <RunDetailPage />,
            handle: { title: 'Run' } satisfies RouteHandle,
          },
          {
            path: 'nodes',
            element: <NodesPage />,
            handle: { title: 'Nodes' } satisfies RouteHandle,
          },
          {
            path: 'nodes/:id',
            element: <NodeDetailPage />,
            handle: { title: 'Node' } satisfies RouteHandle,
          },
          {
            path: 'transcripts',
            element: <TranscriptsPage />,
            handle: { title: 'Transcripts', fullBleed: true } satisfies RouteHandle,
          },
          {
            path: 'transcripts/:id',
            element: <TranscriptDetailPage />,
            handle: { title: 'Transcript', fullBleed: true } satisfies RouteHandle,
          },
        ],
      },
    ],
  },
]);
