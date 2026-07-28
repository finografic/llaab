import { CopyMinusIcon, CopyPlusIcon } from '@llaab/icons';
import { Button } from 'components/ui/button';
import { SidebarContent, SidebarHeader } from 'components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from 'components/ui/tooltip';
import { useCallback, useRef, useState } from 'react';
import type { VaultNode } from '../vault-browser.types';
import type { VaultFileTreeExpansionHandle } from './VaultFileTree';

import { collectVaultFilePaths } from '../vault-browser.utils';
import { VaultFileTree } from './VaultFileTree';

export interface VaultSidebarProps {
  tree: VaultNode[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

export function VaultSidebar({ tree, selectedPath, onSelect }: VaultSidebarProps) {
  const fileCount = collectVaultFilePaths(tree).length;
  const expansionRef = useRef<VaultFileTreeExpansionHandle | null>(null);
  const [hasExpanded, setHasExpanded] = useState(false);
  const onHasExpandedChange = useCallback((next: boolean) => {
    setHasExpanded(next);
  }, []);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden border-r bg-sidebar text-sidebar-foreground">
      <SidebarHeader className="border-b p-4">
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="text-base font-medium text-foreground">Vault</div>
            <span className="section__count">{fileCount}</span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 -mr-2 [&_svg]:size-3.5"
                aria-label={hasExpanded ? 'Collapse all folders' : 'Expand all folders'}
                onClick={() => expansionRef.current?.toggleExpansion()}
              >
                {hasExpanded ? <CopyMinusIcon aria-hidden /> : <CopyPlusIcon aria-hidden />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{hasExpanded ? 'Collapse all' : 'Expand all'}</TooltipContent>
          </Tooltip>
        </div>
      </SidebarHeader>
      <SidebarContent className="min-h-0 flex-1 overflow-hidden">
        <VaultFileTree
          tree={tree}
          selectedPath={selectedPath}
          onSelect={onSelect}
          expansionRef={expansionRef}
          onHasExpandedChange={onHasExpandedChange}
        />
      </SidebarContent>
    </div>
  );
}
