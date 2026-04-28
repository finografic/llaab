import { createTreeCollection, TreeView } from '@finografic/design-system/components';
import { ChevronRightIcon, FileIcon, FolderIcon, FolderOpenIcon } from '@finografic/icons';
import { useMemo, useState } from 'react';

import { api } from '../lib/api';
import s from './VaultBrowser.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VaultNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: VaultNode[];
}

interface Props {
  tree: VaultNode[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VaultBrowser({ tree }: Props) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const collection = useMemo(
    () =>
      createTreeCollection<VaultNode>({
        nodeToValue: (node) => node.path,
        nodeToString: (node) => node.name,
        rootNode: { name: '__ROOT__', path: '__ROOT__', type: 'dir', children: tree },
      }),
    [tree],
  );

  const defaultExpandedValue = useMemo(() => tree.filter((n) => n.type === 'dir').map((n) => n.path), [tree]);

  const selectFile = async (path: string) => {
    if (selectedPath === path) return;
    setSelectedPath(path);
    setContent(null);
    setError(null);
    setLoading(true);
    try {
      const res = await api.vault.file.$get({ query: { path } });
      const json = await res.json();
      if ('error' in json) throw new Error(json.error);
      setContent(json.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={s.browser}>
      <nav className={s.tree} aria-label="Vault files">
        <TreeView.Root
          collection={collection as any}
          selectedValue={selectedPath ? [selectedPath] : []}
          defaultExpandedValue={defaultExpandedValue}
          onSelectionChange={({ selectedValue }) => {
            const path = selectedValue[0];
            if (path) selectFile(path);
          }}
          size="sm"
          className={s.treeRoot}
        >
          <TreeView.Tree>
            {tree.map((node, index) => (
              <VaultTreeNode key={node.path} node={node} indexPath={[index]} />
            ))}
          </TreeView.Tree>
        </TreeView.Root>
      </nav>

      <div className={s.viewer}>
        {!selectedPath && <p className={s.viewerEmpty}>Select a file to view its contents.</p>}
        {selectedPath && loading && <p className={s.viewerLoading}>Loading…</p>}
        {selectedPath && error && <p className={s.viewerError}>{error}</p>}
        {selectedPath && !loading && content !== null && (
          <div className={s.viewerContent}>
            <p className={s.viewerPath}>{selectedPath}</p>
            <pre className={s.viewerPre}>{content}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Recursive tree node ──────────────────────────────────────────────────────

interface VaultTreeNodeProps {
  node: VaultNode;
  indexPath: number[];
}

function VaultTreeNode({ node, indexPath }: VaultTreeNodeProps) {
  return (
    <TreeView.NodeProvider node={node} indexPath={indexPath}>
      <TreeView.NodeContext>
        {(state) =>
          node.type === 'dir' ? (
            <TreeView.Branch>
              <TreeView.BranchControl>
                <TreeView.BranchIndicator>
                  <ChevronRightIcon width={12} height={12} aria-hidden />
                </TreeView.BranchIndicator>
                <TreeView.BranchText>
                  {state.expanded ? (
                    <FolderOpenIcon width={14} height={14} aria-hidden />
                  ) : (
                    <FolderIcon width={14} height={14} aria-hidden />
                  )}
                  {node.name}
                </TreeView.BranchText>
              </TreeView.BranchControl>
              <TreeView.BranchContent>
                <TreeView.BranchIndentGuide />
                {node.children?.map((child, i) => (
                  <VaultTreeNode key={child.path} node={child} indexPath={[...indexPath, i]} />
                ))}
              </TreeView.BranchContent>
            </TreeView.Branch>
          ) : (
            <TreeView.Item>
              <TreeView.ItemText>
                <FileIcon width={14} height={14} aria-hidden />
                {node.name}
              </TreeView.ItemText>
            </TreeView.Item>
          )
        }
      </TreeView.NodeContext>
    </TreeView.NodeProvider>
  );
}
