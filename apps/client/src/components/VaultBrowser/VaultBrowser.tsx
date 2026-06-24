import { useAppLeftSidebar } from 'layouts/AppLayout/AppLeftSidebarContext';
import { useMemo, useState } from 'react';
import type { VaultNode } from './vault-browser.types';

import { VaultFileViewer } from './components/VaultFileViewer';
import { VaultSidebar } from './components/VaultSidebar';

export type { VaultNode } from './vault-browser.types';

const VAULT_SIDEBAR_ID = 'vault-browser';
const VAULT_SIDEBAR_MIN_WIDTH = '280px';
const VAULT_SIDEBAR_MAX_WIDTH = '720px';
const VAULT_SIDEBAR_DEFAULT_WIDTH = '480px';

export interface VaultBrowserProps {
  tree: VaultNode[];
}

export function VaultBrowser({ tree }: VaultBrowserProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const sidebarContent = useMemo(
    () => <VaultSidebar tree={tree} selectedPath={selectedPath} onSelect={setSelectedPath} />,
    [tree, selectedPath],
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

  return <VaultFileViewer path={selectedPath} />;
}
