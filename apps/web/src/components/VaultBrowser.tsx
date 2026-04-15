import { useState } from 'react';

export interface VaultNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: VaultNode[];
}

interface VaultBrowserProps {
  tree: VaultNode[];
}

interface TreeNodeProps {
  node: VaultNode;
  expanded: Set<string>;
  selectedPath: string | null;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}

function TreeNode({ node, expanded, selectedPath, onToggle, onSelect }: TreeNodeProps) {
  if (node.type === 'dir') {
    const isExpanded = expanded.has(node.path);
    return (
      <li className="tree-item tree-item--dir">
        <button className="tree-btn tree-btn--dir" onClick={() => onToggle(node.path)}>
          <span className="tree-chevron">{isExpanded ? '▾' : '▸'}</span>
          <span className="tree-label">{node.name}</span>
        </button>
        {isExpanded && node.children && node.children.length > 0 && (
          <ul className="tree-children">
            {node.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                expanded={expanded}
                selectedPath={selectedPath}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  const isSelected = selectedPath === node.path;
  return (
    <li className="tree-item tree-item--file">
      <button
        className="tree-btn tree-btn--file"
        data-selected={isSelected || undefined}
        onClick={() => onSelect(node.path)}
      >
        <span className="tree-label">{node.name}</span>
      </button>
    </li>
  );
}

export function VaultBrowser({ tree }: VaultBrowserProps) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(tree.filter((n) => n.type === 'dir').map((n) => n.path)),
  );
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDir = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const selectFile = async (path: string) => {
    if (selectedPath === path) return;
    setSelectedPath(path);
    setContent(null);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/vault/file?path=${encodeURIComponent(path)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Failed to load file.');
      } else {
        setContent(json.content);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="vault-browser">
      <nav className="vault-tree" aria-label="Vault files">
        <ul className="tree-root">
          {tree.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              expanded={expanded}
              selectedPath={selectedPath}
              onToggle={toggleDir}
              onSelect={selectFile}
            />
          ))}
        </ul>
      </nav>

      <div className="vault-viewer">
        {!selectedPath && <p className="vault-viewer__empty">Select a file to view its contents.</p>}
        {selectedPath && loading && <p className="vault-viewer__loading">Loading…</p>}
        {selectedPath && error && <p className="vault-viewer__error">{error}</p>}
        {selectedPath && !loading && content !== null && (
          <div className="vault-viewer__content">
            <p className="vault-viewer__path">{selectedPath}</p>
            <pre className="vault-viewer__pre">{content}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
