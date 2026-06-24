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

  // The tree's own selection only drives `onSelect` (click inside this tree). When `selectedPath`
  // changes externally — e.g. clicking a file in the Vault Changes sidebar while already on this
  // route — the model (created once, not remounted) needs to be told to update its selection too.
  useEffect(() => {
    if (!selectedPath || model.getSelectedPaths()[0] === selectedPath) return;
    model.getItem(selectedPath)?.select();
    model.scrollToPath(selectedPath, { focus: true });
  }, [selectedPath, model]);

  return <FileTree model={model} style={PIERRE_TREE_THEME_STYLE} />;
}
