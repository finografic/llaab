import { ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react';
import { useVaultFile } from 'queries/vault';
import { useMemo, useState } from 'react';

import styles from './VaultBrowser.module.css';

export interface VaultNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: VaultNode[];
}

interface Props {
  tree: VaultNode[];
}

export function VaultBrowser({ tree }: Props) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(
    new Set(tree.filter((node) => node.type === 'dir').map((node) => node.path)),
  );

  const rootNodes = useMemo(() => tree, [tree]);

  const { data: content, isLoading: loading, error: fileError } = useVaultFile(selectedPath);
  const error = fileError instanceof Error ? fileError.message : fileError ? 'Failed to load file.' : null;

  const toggleDirectory = (path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const selectFile = (path: string) => {
    setSelectedPath(path);
  };

  return (
    <div className={styles.browser}>
      <nav className={styles.tree} aria-label="Vault files">
        <ul className={styles.treeList}>
          {rootNodes.map((node) => (
            <VaultTreeNode
              key={node.path}
              node={node}
              depth={0}
              selectedPath={selectedPath}
              expandedDirs={expandedDirs}
              toggleDirectory={toggleDirectory}
              selectFile={selectFile}
            />
          ))}
        </ul>
      </nav>

      <div className={styles.viewer}>
        {!selectedPath ? <p className={styles.viewerEmpty}>Select a file to view its contents.</p> : null}
        {selectedPath && loading ? <p className={styles.viewerLoading}>Loading…</p> : null}
        {selectedPath && error ? <p className={styles.viewerError}>{error}</p> : null}
        {selectedPath && !loading && content != null ? (
          <div className={styles.viewerContent}>
            <p className={styles.viewerPath}>{selectedPath}</p>
            <pre className={styles.viewerPre}>{content}</pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function VaultTreeNode({
  node,
  depth,
  selectedPath,
  expandedDirs,
  toggleDirectory,
  selectFile,
}: {
  node: VaultNode;
  depth: number;
  selectedPath: string | null;
  expandedDirs: Set<string>;
  toggleDirectory: (path: string) => void;
  selectFile: (path: string) => void;
}) {
  if (node.type === 'dir') {
    const expanded = expandedDirs.has(node.path);

    return (
      <li className={styles.treeNode}>
        <button
          type="button"
          className={styles.treeButton}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => toggleDirectory(node.path)}
        >
          <ChevronRight size={12} className={expanded ? styles.chevronOpen : styles.chevron} aria-hidden />
          {expanded ? <FolderOpen size={14} aria-hidden /> : <Folder size={14} aria-hidden />}
          <span>{node.name}</span>
        </button>

        {expanded && node.children?.length ? (
          <ul className={styles.treeChildren}>
            {node.children.map((child) => (
              <VaultTreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                expandedDirs={expandedDirs}
                toggleDirectory={toggleDirectory}
                selectFile={selectFile}
              />
            ))}
          </ul>
        ) : null}
      </li>
    );
  }

  const active = selectedPath === node.path;

  return (
    <li className={styles.treeNode}>
      <button
        type="button"
        className={styles.treeButton}
        data-active={active || undefined}
        style={{ paddingLeft: `${28 + depth * 16}px` }}
        onClick={() => selectFile(node.path)}
      >
        <FileText size={14} aria-hidden />
        <span>{node.name}</span>
      </button>
    </li>
  );
}
