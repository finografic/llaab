import { FileTree, useFileTree, useFileTreeSelection } from '@pierre/trees/react';
import { useEffect, useMemo, useRef } from 'react';
import type { VaultNode } from '../vault-browser.types';

import { PIERRE_TREE_THEME_STYLE, PIERRE_TREE_UNSAFE_CSS } from 'constants/pierre-trees-theme';

import { collectVaultFilePaths } from '../vault-browser.utils';

export interface VaultFileTreeProps {
  tree: VaultNode[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

export function VaultFileTree({ tree, selectedPath, onSelect }: VaultFileTreeProps) {
  const filePaths = useMemo(() => collectVaultFilePaths(tree), [tree]);
  const ignoreSelectionRef = useRef<string | null>(null);

  const { model } = useFileTree({
    paths: filePaths,
    initialExpansion: 'open',
    initialSelectedPaths: selectedPath ? [selectedPath] : undefined,
    unsafeCSS: PIERRE_TREE_UNSAFE_CSS,
  });

  const selection = useFileTreeSelection(model);

  // The tree's own selection only drives `onSelect` (click inside this tree). When `selectedPath`
  // changes externally — e.g. clicking a file in the Vault Changes sidebar while already on this
  // route — the model (created once, not remounted) needs to be told to update its selection too.
  useEffect(() => {
    const currentSelection = model.getSelectedPaths();
    const currentSelectedPath = currentSelection[0] ?? null;
    const hasSelectedPath = selectedPath ? filePaths.includes(selectedPath) : false;

    if (!selectedPath || !hasSelectedPath) {
      if (currentSelection.length > 0) {
        ignoreSelectionRef.current = currentSelectedPath;
        currentSelection.forEach((path) => model.getItem(path)?.deselect());
      }
      return;
    }

    if (currentSelection.length === 1 && currentSelectedPath === selectedPath) return;

    ignoreSelectionRef.current = currentSelectedPath;
    currentSelection.forEach((path) => model.getItem(path)?.deselect());
    model.getItem(selectedPath)?.select();
    model.scrollToPath(selectedPath, { focus: true });
  }, [filePaths, selectedPath, model]);

  useEffect(() => {
    const next = selection[0] ?? null;
    if (!next || next === selectedPath) return;
    if (next === ignoreSelectionRef.current) {
      ignoreSelectionRef.current = null;
      return;
    }
    onSelect(next);
  }, [selection, selectedPath, onSelect]);

  return <FileTree model={model} style={PIERRE_TREE_THEME_STYLE} />;
}
