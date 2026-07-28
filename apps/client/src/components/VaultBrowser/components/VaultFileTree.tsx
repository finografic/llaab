import { FileTree, useFileTree, useFileTreeSelection, useFileTreeSelector } from '@pierre/trees/react';
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import type { VaultNode } from '../vault-browser.types';
import type { Ref } from 'react';

import { PIERRE_TREE_THEME_STYLE, PIERRE_TREE_UNSAFE_CSS } from 'constants/pierre-trees-theme';

import { collectVaultDirectoryPaths, collectVaultFilePaths } from '../vault-browser.utils';

export interface VaultFileTreeProps {
  tree: VaultNode[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onHasExpandedChange?: (hasExpanded: boolean) => void;
  expansionRef?: Ref<VaultFileTreeExpansionHandle | null>;
}

export interface VaultFileTreeExpansionHandle {
  expandAll: () => void;
  collapseAll: () => void;
  toggleExpansion: () => void;
}

export function VaultFileTree({
  tree,
  selectedPath,
  onSelect,
  onHasExpandedChange,
  expansionRef,
}: VaultFileTreeProps) {
  const filePaths = useMemo(() => collectVaultFilePaths(tree), [tree]);
  const directoryPaths = useMemo(() => collectVaultDirectoryPaths(filePaths), [filePaths]);
  const ignoreSelectionRef = useRef<string | null>(null);

  const { model } = useFileTree({
    paths: filePaths,
    initialExpansion: 'closed',
    initialSelectedPaths: selectedPath ? [selectedPath] : undefined,
    unsafeCSS: PIERRE_TREE_UNSAFE_CSS,
  });

  const selection = useFileTreeSelection(model);

  const hasExpanded = useFileTreeSelector(
    model,
    useCallback(
      (currentModel) => {
        for (const path of directoryPaths) {
          const item = currentModel.getItem(path);
          if (item?.isDirectory() && item.isExpanded()) return true;
        }
        return false;
      },
      [directoryPaths],
    ),
  );

  const expandAll = useCallback(() => {
    for (const path of directoryPaths) {
      const item = model.getItem(path);
      if (item?.isDirectory() && !item.isExpanded()) item.expand();
    }
  }, [directoryPaths, model]);

  const collapseAll = useCallback(() => {
    // Deepest directories first so nested open state clears cleanly.
    for (const path of [...directoryPaths].toReversed()) {
      const item = model.getItem(path);
      if (item?.isDirectory() && item.isExpanded()) item.collapse();
    }
  }, [directoryPaths, model]);

  const toggleExpansion = useCallback(() => {
    if (hasExpanded) {
      collapseAll();
      return;
    }
    expandAll();
  }, [collapseAll, expandAll, hasExpanded]);

  useImperativeHandle(
    expansionRef,
    () => ({
      expandAll,
      collapseAll,
      toggleExpansion,
    }),
    [collapseAll, expandAll, toggleExpansion],
  );

  useEffect(() => {
    onHasExpandedChange?.(hasExpanded);
  }, [hasExpanded, onHasExpandedChange]);

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
