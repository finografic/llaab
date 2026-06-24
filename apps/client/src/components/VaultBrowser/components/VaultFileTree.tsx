import { FileTree, useFileTree, useFileTreeSelection } from '@pierre/trees/react';
import { useEffect, useMemo } from 'react';
import type { VaultNode } from '../vault-browser.types';

import { PIERRE_TREE_THEME_STYLE, PIERRE_TREE_UNSAFE_CSS } from 'lib/pierre-trees-theme';

import { collectVaultFilePaths } from '../vault-browser.utils';

export interface VaultFileTreeProps {
  tree: VaultNode[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

export function VaultFileTree({ tree, selectedPath, onSelect }: VaultFileTreeProps) {
  const filePaths = useMemo(() => collectVaultFilePaths(tree), [tree]);

  const { model } = useFileTree({
    paths: filePaths,
    initialExpansion: 'open',
    initialSelectedPaths: selectedPath ? [selectedPath] : undefined,
    unsafeCSS: PIERRE_TREE_UNSAFE_CSS,
  });

  const selection = useFileTreeSelection(model);

  useEffect(() => {
    const next = selection[0];
    if (next && next !== selectedPath) onSelect(next);
  }, [selection, selectedPath, onSelect]);

  return <FileTree model={model} style={PIERRE_TREE_THEME_STYLE} />;
}
