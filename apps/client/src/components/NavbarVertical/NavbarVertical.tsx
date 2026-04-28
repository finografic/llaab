import { createTreeCollection, TreeView } from '@finografic/design-system/components';
import type { ReactNode } from 'react';

import s from './NavbarVertical.module.css';

// ─── Nav config ───────────────────────────────────────────────────────────────

interface NavNode {
  id: string;
  label: string;
  icon?: ReactNode;
  children?: NavNode[];
}

const NAV_NODES: NavNode[] = [
  { id: '/', label: 'Home', icon: <IconHome /> },
  { id: '/ingest', label: 'Ingest', icon: <IconIngest /> },
  {
    id: '/vault',
    label: 'Vault',
    icon: <IconVault />,
    children: [
      { id: '/vault/transcripts', label: 'Transcripts' },
      { id: '/vault/nodes', label: 'Nodes' },
      { id: '/vault/sources', label: 'Sources' },
      { id: '/vault/runs', label: 'Runs' },
    ],
  },
  { id: '/llm', label: 'LLM', icon: <IconLlm /> },
];

// Collection is stable — created once at module scope.
const navCollection = createTreeCollection<NavNode>({
  nodeToValue: (node) => node.id,
  nodeToString: (node) => node.label,
  rootNode: { id: '__ROOT__', label: '', children: NAV_NODES },
});

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  pathname: string;
}

export function NavbarVertical({ pathname }: Props) {
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  // Drive Ark's selected state from pathname so [data-selected] renders correctly.
  const selectedValue = NAV_NODES.flatMap((n) => n.children ?? [n])
    .filter((n) => isActive(n.id))
    .map((n) => n.id);

  // Pre-expand sections that contain the active route on initial load.
  const defaultExpandedValue = NAV_NODES.filter((n) => n.children?.some((c) => isActive(c.id))).map(
    (n) => n.id,
  );

  return (
    <nav className={s.nav} aria-label="Main navigation">
      <a href="/" className={s.brand}>
        LLAAB
      </a>

      <hr className={s.divider} />

      <TreeView.Root
        collection={navCollection as any}
        selectedValue={selectedValue}
        defaultExpandedValue={defaultExpandedValue}
        size="sm"
        className={s.treeRoot}
      >
        <TreeView.Tree className={s.tree}>
          {NAV_NODES.map((node, index) => (
            <NavNode key={node.id} node={node} indexPath={[index]} isActive={isActive} />
          ))}
        </TreeView.Tree>
      </TreeView.Root>
    </nav>
  );
}

// ─── Recursive node renderer ──────────────────────────────────────────────────

interface NavNodeProps {
  node: NavNode;
  indexPath: number[];
  isActive: (href: string) => boolean;
}

function NavNode({ node, indexPath, isActive }: NavNodeProps) {
  const active = isActive(node.id);

  return (
    <TreeView.NodeProvider node={node} indexPath={indexPath}>
      {node.children ? (
        <TreeView.Branch className={s.branch}>
          {/*
           * Split row: navigation link + expand toggle are separate interactive elements.
           * This avoids the invalid <a> inside <button> pattern while keeping both
           * navigation (link) and keyboard expand (BranchControl) fully accessible.
           */}
          <div className={s.branchRow}>
            <a
              href={node.id}
              className={s.branchLink}
              data-active={active || undefined}
              aria-current={active ? 'page' : undefined}
            >
              <span className={s.icon} aria-hidden="true">
                {node.icon}
              </span>
              <span className={s.label}>{node.label}</span>
            </a>

            <TreeView.BranchControl className={s.expandBtn}>
              <TreeView.BranchIndicator className={s.indicator}>
                <IconChevron />
              </TreeView.BranchIndicator>
            </TreeView.BranchControl>
          </div>

          <TreeView.BranchContent className={s.branchContent}>
            <TreeView.BranchIndentGuide className={s.indentGuide} />
            {node.children.map((child, i) => (
              <NavNode key={child.id} node={child} indexPath={[...indexPath, i]} isActive={isActive} />
            ))}
          </TreeView.BranchContent>
        </TreeView.Branch>
      ) : (
        // Leaf node — the whole Item renders as an <a> via asChild.
        <TreeView.Item asChild className={s.leafItem} data-active={active || undefined}>
          <a href={node.id} aria-current={active ? 'page' : undefined}>
            <TreeView.ItemText className={s.itemText}>
              {node.icon && (
                <span className={s.icon} aria-hidden="true">
                  {node.icon}
                </span>
              )}
              <span className={s.label}>{node.label}</span>
            </TreeView.ItemText>
          </a>
        </TreeView.Item>
      )}
    </TreeView.NodeProvider>
  );
}

// ─── Icons (inline SVG — swap for DS icons when ready) ───────────────────────

function IconHome() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function IconIngest() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v13M7 11l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function IconVault() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 9V7M12 17v-2M9 12H7M17 12h-2" />
    </svg>
  );
}

function IconLlm() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 0 6h-1v1a4 4 0 0 1-8 0v-1H7a3 3 0 0 1 0-6h1V6a4 4 0 0 1 4-4z" />
      <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
