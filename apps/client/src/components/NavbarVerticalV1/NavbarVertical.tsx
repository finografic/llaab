import { useState } from 'react';
import type React from 'react';

import s from './NavbarVertical.module.css';

// ─── Nav config ───────────────────────────────────────────────────────────────
// Swap icons for @finografic/icons components when ready.

interface NavChild {
  label: string;
  href: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  children?: NavChild[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Home',
    href: '/',
    icon: <IconHome />,
  },
  {
    label: 'Ingest',
    href: '/ingest',
    icon: <IconIngest />,
  },
  // {
  //   label: 'Vault',
  //   href: '/vault',
  //   icon: <IconVault />,
  //   children: [
  //     { label: 'Transcripts', href: '/vault/transcripts' },
  //     { label: 'Nodes', href: '/vault/nodes' },
  //     { label: 'Sources', href: '/vault/sources' },
  //     { label: 'Runs', href: '/vault/runs' },
  //   ],
  // },
  {
    label: 'Vault',
    href: '/vault',
    icon: <IconVault />,
    children: [
      { label: 'Transcripts', href: '/vault/transcripts' },
      { label: 'Nodes', href: '/vault/nodes' },
      { label: 'Sources', href: '/vault/sources' },
      { label: 'Runs', href: '/vault/runs' },
    ],
  },
  {
    label: 'LLM',
    href: '/llm',
    icon: <IconLlm />,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  pathname: string;
}

export function NavbarVertical({ pathname }: Props) {
  // Sections with children default to open when any child is active.
  const defaultOpen = (item: NavItem) => item.children?.some((c) => pathname.startsWith(c.href)) ?? false;

  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV_ITEMS.filter((i) => i.children).map((i) => [i.href, defaultOpen(i)])),
  );

  const toggle = (href: string) => setOpen((prev) => ({ ...prev, [href]: !prev[href] }));

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <nav className={s.nav} aria-label="Main navigation">
      {/* Brand */}
      <a href="/" className={s.brand}>
        LLAAB
      </a>

      <hr className={s.divider} />

      {/* Nav items */}
      <ul className={s.list} role="list">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const expanded = open[item.href] ?? false;

          return (
            <li key={item.href}>
              <div className={s.itemRow}>
                <a
                  href={item.href}
                  className={`${s.item} ${active ? s.itemActive : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className={s.icon} aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className={s.label}>{item.label}</span>
                </a>

                {item.children && (
                  <button
                    type="button"
                    className={s.chevronBtn}
                    onClick={() => toggle(item.href)}
                    aria-expanded={expanded}
                    aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.label}`}
                  >
                    <IconChevron className={`${s.chevron} ${expanded ? s.chevronOpen : ''}`} />
                  </button>
                )}
              </div>

              {item.children && expanded && (
                <ul className={s.subList} role="list">
                  {item.children.map((child) => {
                    const childActive = pathname === child.href || pathname.startsWith(child.href + '/');
                    return (
                      <li key={child.href}>
                        <a
                          href={child.href}
                          className={`${s.subItem} ${childActive ? s.subItemActive : ''}`}
                          aria-current={childActive ? 'page' : undefined}
                        >
                          {child.label}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ─── Icons (inline SVG — swap for DS icons later) ─────────────────────────────

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

function IconChevron({ className }: { className?: string }) {
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
      className={className}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
