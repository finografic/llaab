import { useAppLeftSidebar } from 'layouts/AppLayout/AppLeftSidebarContext';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { VaultNode } from './vault-browser.types';

import { BREAKPOINTS } from 'lib/viewport';

import { VaultFileViewer } from './components/VaultFileViewer';
import { VaultSidebar } from './components/VaultSidebar';

export type { VaultNode } from './vault-browser.types';

const VAULT_SIDEBAR_ID = 'vault-browser';
const VAULT_SIDEBAR_MIN_WIDTH = '300px';
const VAULT_SIDEBAR_WIDE_DEFAULT_WIDTH = '430px';
const VAULT_SIDEBAR_WIDE_MAX_WIDTH = '580px';
const VAULT_SIDEBAR_WIDE_BREAKPOINT = BREAKPOINTS['2xl'];
const PATH_SEARCH_PARAM = 'path';
const VIEW_SEARCH_PARAM = 'view';
const DIFF_VIEW = 'diff';
const RENDER_VIEW = 'render';
const ENHANCED_VIEW = 'enhanced';
type MarkdownView = 'raw' | 'render' | 'enhanced';

function useWideVaultSidebar(): boolean {
  const [wide, setWide] = useState(false);

  useEffect(() => {
    function updateWideSidebar() {
      setWide(window.innerWidth > VAULT_SIDEBAR_WIDE_BREAKPOINT);
    }

    updateWideSidebar();
    window.addEventListener('resize', updateWideSidebar);

    return () => window.removeEventListener('resize', updateWideSidebar);
  }, []);

  return wide;
}

export interface VaultBrowserProps {
  tree: VaultNode[];
}

export function VaultBrowser({ tree }: VaultBrowserProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const wideVaultSidebar = useWideVaultSidebar();
  // Search params are the single source of truth, so external navigation (e.g. clicking a
  // file in the Vault Changes sidebar while already on this route) is picked up immediately —
  // a separate `useState` mirror would only capture the value at mount.
  const selectedPath = searchParams.get(PATH_SEARCH_PARAM);
  const view = searchParams.get(VIEW_SEARCH_PARAM);
  const showDiff = view === DIFF_VIEW;
  const showRenderedMarkdown = view === RENDER_VIEW;
  const showEnhancedMarkdown = view === ENHANCED_VIEW;

  const setSelectedPath = useCallback(
    (path: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(PATH_SEARCH_PARAM, path);
          if (next.get(VIEW_SEARCH_PARAM) === DIFF_VIEW) {
            next.delete(VIEW_SEARCH_PARAM);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setMarkdownView = useCallback(
    (mode: MarkdownView) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (mode === 'render') {
            next.set(VIEW_SEARCH_PARAM, RENDER_VIEW);
          } else if (mode === 'enhanced') {
            next.set(VIEW_SEARCH_PARAM, ENHANCED_VIEW);
          } else {
            next.delete(VIEW_SEARCH_PARAM);
          }
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
      maxWidth: wideVaultSidebar ? VAULT_SIDEBAR_WIDE_MAX_WIDTH : VAULT_SIDEBAR_MIN_WIDTH,
      defaultWidth: wideVaultSidebar ? VAULT_SIDEBAR_WIDE_DEFAULT_WIDTH : VAULT_SIDEBAR_MIN_WIDTH,
    }),
    [sidebarContent, wideVaultSidebar],
  );

  useAppLeftSidebar(leftSidebar);

  return (
    <VaultFileViewer
      path={selectedPath}
      showDiff={showDiff}
      showRenderedMarkdown={showRenderedMarkdown}
      showEnhancedMarkdown={showEnhancedMarkdown}
      onMarkdownViewChange={setMarkdownView}
    />
  );
}
