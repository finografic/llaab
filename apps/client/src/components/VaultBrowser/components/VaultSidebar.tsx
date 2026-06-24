import { SidebarContent, SidebarHeader } from 'components/ui/sidebar';
import type { VaultNode } from '../vault-browser.types';

import { collectVaultFilePaths } from '../vault-browser.utils';
import { VaultFileTree } from './VaultFileTree';

export interface VaultSidebarProps {
  tree: VaultNode[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

export function VaultSidebar({ tree, selectedPath, onSelect }: VaultSidebarProps) {
  const fileCount = collectVaultFilePaths(tree).length;

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden border-r bg-sidebar text-sidebar-foreground">
      <SidebarHeader className="border-b p-4">
        <div className="flex w-full items-center justify-between">
          <div className="text-base font-medium text-foreground">Vault</div>
          <span className="font-mono text-xs text-muted-foreground">{fileCount}</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="min-h-0 flex-1 overflow-hidden">
        <VaultFileTree tree={tree} selectedPath={selectedPath} onSelect={onSelect} />
      </SidebarContent>
    </div>
  );
}
