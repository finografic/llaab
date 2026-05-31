import { Brain, ChevronRight, Download, FolderKanban, Home } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import s from './NavbarVertical.module.css';

interface NavNode {
  id: string;
  label: string;
  icon?: ReactNode;
  children?: NavNode[];
}

const NAV_NODES: NavNode[] = [
  { id: '/', label: 'Home', icon: <Home size={15} /> },
  { id: '/ingest', label: 'Ingest', icon: <Download size={15} /> },
  {
    id: '/vault',
    label: 'Vault',
    icon: <FolderKanban size={15} />,
    children: [
      { id: '/vault/transcripts', label: 'Transcripts' },
      { id: '/vault/nodes', label: 'Nodes' },
      { id: '/vault/sources', label: 'Sources' },
      { id: '/vault/runs', label: 'Runs' },
    ],
  },
  { id: '/llm', label: 'LLM', icon: <Brain size={15} /> },
];

interface Props {
  pathname: string;
}

export function NavbarVertical({ pathname }: Props) {
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const defaultExpanded = new Set(
    NAV_NODES.filter((node) => node.children?.some((child) => isActive(child.id))).map((node) => node.id),
  );
  const [expandedSections, setExpandedSections] = useState<Set<string>>(defaultExpanded);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <nav className={s.nav} aria-label="Main navigation">
      <a href="/" className={s.brand}>
        LLAAB
      </a>

      <hr className={s.divider} />

      <ul className={s.navList}>
        {NAV_NODES.map((node) => (
          <NavItem
            key={node.id}
            node={node}
            isActive={isActive}
            expandedSections={expandedSections}
            toggleSection={toggleSection}
          />
        ))}
      </ul>
    </nav>
  );
}

function NavItem({
  node,
  isActive,
  expandedSections,
  toggleSection,
}: {
  node: NavNode;
  isActive: (href: string) => boolean;
  expandedSections: Set<string>;
  toggleSection: (id: string) => void;
}) {
  const active = isActive(node.id);

  if (!node.children) {
    return (
      <li>
        <a
          href={node.id}
          className={s.link}
          data-active={active || undefined}
          aria-current={active ? 'page' : undefined}
        >
          {node.icon ? (
            <span className={s.icon} aria-hidden="true">
              {node.icon}
            </span>
          ) : null}
          <span className={s.label}>{node.label}</span>
        </a>
      </li>
    );
  }

  const expanded = expandedSections.has(node.id);

  return (
    <li className={s.branch}>
      <div className={s.branchRow}>
        <a
          href={node.id}
          className={s.link}
          data-active={active || undefined}
          aria-current={active ? 'page' : undefined}
        >
          {node.icon ? (
            <span className={s.icon} aria-hidden="true">
              {node.icon}
            </span>
          ) : null}
          <span className={s.label}>{node.label}</span>
        </a>
        <button
          type="button"
          className={s.expandBtn}
          aria-label={expanded ? `Collapse ${node.label}` : `Expand ${node.label}`}
          aria-expanded={expanded}
          onClick={() => toggleSection(node.id)}
        >
          <ChevronRight size={12} className={expanded ? s.expandIconOpen : s.expandIcon} />
        </button>
      </div>

      {expanded ? (
        <ul className={s.branchList}>
          {node.children.map((child) => {
            const childActive = isActive(child.id);
            return (
              <li key={child.id}>
                <a
                  href={child.id}
                  className={s.link}
                  data-variant="child"
                  data-active={childActive || undefined}
                  aria-current={childActive ? 'page' : undefined}
                >
                  <span className={s.label}>{child.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}
