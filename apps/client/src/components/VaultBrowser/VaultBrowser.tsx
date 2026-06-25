import { useAppLeftSidebar } from 'layouts/AppLayout/AppLeftSidebarContext';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { VaultNode } from './vault-browser.types';

import { VaultFileViewer } from './components/VaultFileViewer';
import { VaultSidebar } from './components/VaultSidebar';

export type { VaultNode } from './vault-browser.types';

const VAULT_SIDEBAR_ID = 'vault-browser';
const VAULT_SIDEBAR_MIN_WIDTH = '280px';
const VAULT_SIDEBAR_MAX_WIDTH = '720px';
const VAULT_SIDEBAR_DEFAULT_WIDTH = '480px';
const PATH_SEARCH_PARAM = 'path';
const VIEW_SEARCH_PARAM = 'view';
const DIFF_VIEW = 'diff';

export interface VaultBrowserProps {
  tree: VaultNode[];
}

export function VaultBrowser({ tree }: VaultBrowserProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  // Search params are the single source of truth, so external navigation (e.g. clicking a
  // file in the Vault Changes sidebar while already on this route) is picked up immediately —
  // a separate `useState` mirror would only capture the value at mount.
  const selectedPath = searchParams.get(PATH_SEARCH_PARAM);
  const view = searchParams.get(VIEW_SEARCH_PARAM);
  const showDiff = view === DIFF_VIEW;

  const setSelectedPath = useCallback(
    (path: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(PATH_SEARCH_PARAM, path);
          next.delete(VIEW_SEARCH_PARAM);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const sidebarContent = useMemo(
    () => <VaultSidebar tree={tree} selectedPath={selectedPath} onSelect={setSelectedPath} />,
    [tree, selectedPath, setSelectedPath],
  );

  const leftSidebar = useMemo(
    () => ({
      id: VAULT_SIDEBAR_ID,
      content: sidebarContent,
      defaultOpen: true,
      minWidth: VAULT_SIDEBAR_MIN_WIDTH,
      maxWidth: VAULT_SIDEBAR_MAX_WIDTH,
      defaultWidth: VAULT_SIDEBAR_DEFAULT_WIDTH,
    }),
    [sidebarContent],
  );

  useAppLeftSidebar(leftSidebar);

  return <VaultFileViewer path={selectedPath} showDiff={showDiff} />;
}
