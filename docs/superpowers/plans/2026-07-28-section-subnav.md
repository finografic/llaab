# Section Subnav Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sticky always-visible section subnav under `AppHeader` that lists the current parent section’s megamenu items as internal links, with accent-green active state and reserved height when no section matches.

**Architecture:** Reuse `NAV_MENU_SECTIONS` + `getActiveNavSectionId` / `isNavItemActive`. New `SectionSubnav` mounts in `AppLayout` between `AppHeader` and `SecondaryActionBar`. Layout tokens gain `--section-subnav-h` so fill-height pages stay correct. Section matchers gain Registry, Knowledge, and missing Execute routes (`/hermes`, `/crons`).

**Tech Stack:** React, React Router `Link` / `useLocation`, CSS Modules, Vitest, existing LLAAB layout tokens (`--accent`, `--header-h`, `--secondary-actions-h`).

## Global Constraints

- Source of truth for items: `apps/client/src/lib/nav-menu.config.ts` only — do not duplicate menu data.
- Stack order: `AppHeader` → `SectionSubnav` → `SecondaryActionBar` → page content.
- Always reserve `--section-subnav-h` (empty strip when no section) — no layout jump.
- `live: false` items: muted + `LockIcon` + not clickable (same semantics as megamenu).
- Do not change `SecondaryActionBar` behavior or move its tools into the subnav.
- No hard-coded hex/rgb colors — use `var(--accent)` / muted tokens.
- Micro horizontal link row may use flex on one element group (grid-layout exception); do not introduce Tailwind `grid-cols-*` for this strip.
- Client-only change — no server rebuild / `dev-refresh.sh` required.
- Do not commit unless the user explicitly asks.

---

## File structure

| File                                                                | Responsibility                              |
| ------------------------------------------------------------------- | ------------------------------------------- |
| `apps/client/src/lib/nav-menu.utils.ts`                             | Section matchers + active helpers           |
| `apps/client/src/lib/nav-menu.utils.test.ts`                        | Unit tests for matchers / active resolution |
| `apps/client/src/components/SectionSubnav/SectionSubnav.tsx`        | Subnav UI                                   |
| `apps/client/src/components/SectionSubnav/SectionSubnav.module.css` | Sticky strip styles                         |
| `apps/client/src/layouts/AppLayout/AppLayout.tsx`                   | Mount point                                 |
| `apps/client/src/styles/app.css`                                    | `--section-subnav-h` + `--content-area-h`   |

Unchanged: `nav-menu.config.ts`, `NavMenu`, `SecondaryActionBar`, `AppHeader` (aside from sticky stacking via CSS vars).

---

### Task 1: Fix section matchers + active helper tests

**Files:**

- Modify: `apps/client/src/lib/nav-menu.utils.ts`
- Create: `apps/client/src/lib/nav-menu.utils.test.ts`

**Interfaces:**

- Consumes: none (pure utils)
- Produces:
  - `getActiveNavSectionId(pathname: string): string | null` — must return `'registry'` for `/registry…`, `'knowledge'` for `/knowledge…`, `'execute'` for `/hermes` and `/crons`, and keep Execute-over-Vault for `/vault/runs`
  - `isNavItemActive(pathname: string, href: string): boolean` — unchanged contract
  - `getActiveNavItemHref(pathname: string, hrefs: string[]): string | null` — longest matching live href among siblings (so `/vault` does not stay active on `/vault/transcripts`)

- [ ] **Step 1: Write the failing tests**

Create `apps/client/src/lib/nav-menu.utils.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  getActiveNavItemHref,
  getActiveNavSectionId,
  isNavItemActive,
} from './nav-menu.utils';

describe('getActiveNavSectionId', () => {
  it('resolves registry and knowledge', () => {
    expect(getActiveNavSectionId('/registry/packages')).toBe('registry');
    expect(getActiveNavSectionId('/registry/repos/foo/bar')).toBe('registry');
    expect(getActiveNavSectionId('/knowledge/wikis')).toBe('knowledge');
  });

  it('keeps execute ahead of vault for runs, and covers hermes/crons/terminal', () => {
    expect(getActiveNavSectionId('/vault/runs')).toBe('execute');
    expect(getActiveNavSectionId('/hermes')).toBe('execute');
    expect(getActiveNavSectionId('/crons')).toBe('execute');
    expect(getActiveNavSectionId('/terminal')).toBe('execute');
  });

  it('resolves vault for other vault paths and null for home', () => {
    expect(getActiveNavSectionId('/vault/transcripts')).toBe('vault');
    expect(getActiveNavSectionId('/')).toBeNull();
  });
});

describe('isNavItemActive', () => {
  it('matches exact and nested paths', () => {
    expect(isNavItemActive('/vault', '/vault')).toBe(true);
    expect(isNavItemActive('/vault/nodes', '/vault')).toBe(true);
    expect(isNavItemActive('/vault/nodes', '/vault/nodes')).toBe(true);
    expect(isNavItemActive('/vault', '/vault/nodes')).toBe(false);
  });
});

describe('getActiveNavItemHref', () => {
  const vaultHrefs = [
    '/vault',
    '/vault/nodes',
    '/vault/transcripts',
    '/vault/sources',
    '/vault/inbox',
    '/vault/wiki-candidates',
    '/vault/search',
  ];

  it('prefers the longest matching href among siblings', () => {
    expect(getActiveNavItemHref('/vault/transcripts/abc', vaultHrefs)).toBe('/vault/transcripts');
    expect(getActiveNavItemHref('/vault', vaultHrefs)).toBe('/vault');
    expect(getActiveNavItemHref('/vault/nodes', vaultHrefs)).toBe('/vault/nodes');
  });

  it('returns null when nothing matches', () => {
    expect(getActiveNavItemHref('/llm', vaultHrefs)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @llaab/client exec vitest run src/lib/nav-menu.utils.test.ts --reporter=verbose`

Expected: FAIL — `getActiveNavItemHref` not exported; registry/knowledge/hermes/crons assertions fail or return wrong ids.

- [ ] **Step 3: Implement matchers + longest-match helper**

Replace `apps/client/src/lib/nav-menu.utils.ts` with:

```ts
const SECTION_MATCHERS: Array<{ id: string; matches: (pathname: string) => boolean }> = [
  {
    id: 'execute',
    matches: (pathname) =>
      pathname.startsWith('/vault/runs') ||
      pathname.startsWith('/agent') ||
      pathname.startsWith('/terminal') ||
      pathname.startsWith('/hermes') ||
      pathname.startsWith('/crons') ||
      pathname.startsWith('/execute'),
  },
  {
    id: 'pipeline',
    matches: (pathname) => pathname.startsWith('/ingest') || pathname.startsWith('/pipeline'),
  },
  {
    id: 'models',
    matches: (pathname) => pathname.startsWith('/llm'),
  },
  {
    id: 'system',
    matches: (pathname) =>
      pathname.startsWith('/icons') || pathname.startsWith('/dev/icons') || pathname.startsWith('/system'),
  },
  {
    id: 'registry',
    matches: (pathname) => pathname.startsWith('/registry'),
  },
  {
    id: 'knowledge',
    matches: (pathname) => pathname.startsWith('/knowledge'),
  },
  {
    id: 'vault',
    matches: (pathname) => pathname.startsWith('/vault'),
  },
];

/** Resolve the active top-level nav section. Execute wins over Vault for `/vault/runs`. */
export function getActiveNavSectionId(pathname: string): string | null {
  for (const { id, matches } of SECTION_MATCHERS) {
    if (matches(pathname)) {
      return id;
    }
  }
  return null;
}

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Among sibling hrefs, pick the longest match so list roots do not steal child routes. */
export function getActiveNavItemHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    if (!isNavItemActive(pathname, href)) continue;
    if (best === null || href.length > best.length) {
      best = href;
    }
  }
  return best;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @llaab/client exec vitest run src/lib/nav-menu.utils.test.ts --reporter=verbose`

Expected: PASS (all tests green).

- [ ] **Step 5: Commit (only if user asked)**

Skip unless the user explicitly requested a commit. If asked:

```bash
git add apps/client/src/lib/nav-menu.utils.ts apps/client/src/lib/nav-menu.utils.test.ts
git commit -m "$(cat <<'EOF'
fix(client): resolve registry/knowledge/execute section nav matchers

EOF
)"
```

---

### Task 2: Layout tokens for reserved subnav height

**Files:**

- Modify: `apps/client/src/styles/app.css` (layout dimensions block ~lines 97–101)

**Interfaces:**

- Consumes: existing `--header-h`, `--secondary-actions-h`, `--footer-h`
- Produces: `--section-subnav-h: 36px` and updated `--content-area-h` that subtracts it

- [ ] **Step 1: Update CSS variables**

In `apps/client/src/styles/app.css`, change the layout dimensions block to:

```css
  --sidebar-w: 220px;
  --header-h: 52px;
  --section-subnav-h: 36px;
  --secondary-actions-h: 40px;
  --footer-h: 40px;
  --content-area-h: calc(
    100dvh - var(--header-h) - var(--section-subnav-h) - var(--secondary-actions-h) - var(--footer-h)
  );
```

- [ ] **Step 2: Grep for other `--content-area-h` definitions or hard-coded header stacks**

Run: `rg --glob 'apps/client/**/*' 'content-area-h|header-h|secondary-actions-h'`

Expected: only `app.css` defines `--content-area-h`; consumers keep working via the variable. If any file hard-codes `header + secondary` without the new token, note it for Task 4 manual check — do not invent extra changes unless broken.

- [ ] **Step 3: Commit (only if user asked)**

Skip unless requested.

---

### Task 3: Build `SectionSubnav` component

**Files:**

- Create: `apps/client/src/components/SectionSubnav/SectionSubnav.tsx`
- Create: `apps/client/src/components/SectionSubnav/SectionSubnav.module.css`

**Interfaces:**

- Consumes: `NAV_MENU_SECTIONS`, `getActiveNavSectionId`, `getActiveNavItemHref` from Task 1; `--section-subnav-h` from Task 2; `LockIcon` from `lucide-react`; `Link` / `useLocation` from `react-router-dom`
- Produces: `export function SectionSubnav(): JSX.Element` — always renders a fixed-height sticky strip

- [ ] **Step 1: Add CSS module**

Create `apps/client/src/components/SectionSubnav/SectionSubnav.module.css`:

```css
.subnav {
  position: sticky;
  top: var(--header-h);
  z-index: 40;
  display: flex;
  align-items: center;
  width: 100%;
  height: var(--section-subnav-h);
  min-height: var(--section-subnav-h);
  max-height: var(--section-subnav-h);
  padding: 0 var(--space-6);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
  background: var(--bg-subtle);
}

.list {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-width: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
}

.link,
.disabled {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  white-space: nowrap;
  font-size: var(--text-sm, 0.875rem);
  font-weight: 500;
  text-decoration: none;
  line-height: 1;
}

.link {
  color: var(--text-muted);
}

.link:hover {
  color: var(--text);
}

.linkActive {
  color: var(--accent);
}

.linkActive:hover {
  color: var(--accent);
}

.disabled {
  color: var(--text-muted);
  opacity: 0.5;
  pointer-events: none;
  user-select: none;
}

.lockIcon {
  width: 0.75rem;
  height: 0.75rem;
  flex-shrink: 0;
}
```

- [ ] **Step 2: Add component**

Create `apps/client/src/components/SectionSubnav/SectionSubnav.tsx`:

```tsx
import { cn } from '@llaab/ui/lib/utils';
import { LockIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { NAV_MENU_SECTIONS } from 'lib/nav-menu.config';
import { getActiveNavItemHref, getActiveNavSectionId } from 'lib/nav-menu.utils';

import styles from './SectionSubnav.module.css';

export function SectionSubnav() {
  const { pathname } = useLocation();
  const sectionId = getActiveNavSectionId(pathname);
  const section = sectionId ? NAV_MENU_SECTIONS.find((entry) => entry.id === sectionId) : undefined;
  const activeHref = section
    ? getActiveNavItemHref(
        pathname,
        section.items.filter((item) => item.live).map((item) => item.href),
      )
    : null;

  return (
    <nav className={styles.subnav} aria-label="Section">
      {section ? (
        <ul className={styles.list}>
          {section.items.map((item) => {
            if (!item.live) {
              return (
                <li key={item.href}>
                  <span className={styles.disabled} aria-disabled="true">
                    {item.label}
                    <LockIcon className={styles.lockIcon} aria-hidden="true" />
                    <span className="sr-only"> (coming soon)</span>
                  </span>
                </li>
              );
            }

            const active = activeHref === item.href;

            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={cn(styles.link, active && styles.linkActive)}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </nav>
  );
}
```

- [ ] **Step 3: Typecheck the new module**

Run: `pnpm --filter @llaab/client exec tsc --noEmit -p tsconfig.json 2>&1 | head -n 40`

Expected: no errors referring to `SectionSubnav`. Pre-existing unrelated errors may appear — do not fix them in this task.

- [ ] **Step 4: Commit (only if user asked)**

Skip unless requested.

---

### Task 4: Wire into `AppLayout` + manual verification

**Files:**

- Modify: `apps/client/src/layouts/AppLayout/AppLayout.tsx`

**Interfaces:**

- Consumes: `SectionSubnav` from Task 3
- Produces: rendered stack `AppHeader` → `SectionSubnav` → sidebar layout (with `SecondaryActionBar` as its header)

- [ ] **Step 1: Mount SectionSubnav**

In `apps/client/src/layouts/AppLayout/AppLayout.tsx`:

1. Add import:

```tsx
import { SectionSubnav } from 'components/SectionSubnav/SectionSubnav';
```

2. In the return JSX, change:

```tsx
    <div className={styles.appShell}>
      <AppHeader />
      <SecondaryActionBarContext.Provider value={secondaryActionBarValue}>
```

to:

```tsx
    <div className={styles.appShell}>
      <AppHeader />
      <SectionSubnav />
      <SecondaryActionBarContext.Provider value={secondaryActionBarValue}>
```

Do not move or alter `SecondaryActionBar` props.

- [ ] **Step 2: Re-run unit tests**

Run: `pnpm --filter @llaab/client exec vitest run src/lib/nav-menu.utils.test.ts --reporter=verbose`

Expected: PASS.

- [ ] **Step 3: Manual browser checklist**

Hard-refresh `http://llaab.localhost:5050` (or local client URL) and verify:

| Route                    | Expect                                                            |
| ------------------------ | ----------------------------------------------------------------- |
| `/`                      | Empty subnav strip, same height as other pages                    |
| `/vault/transcripts/...` | Vault items; **Transcripts** accent green; Browse Vault not green |
| `/knowledge/wikis`       | Knowledge → Wikis active                                          |
| `/registry/packages`     | Registry → Packages active                                        |
| `/vault/runs`            | Execute section (not Vault); Runs active                          |
| `/hermes`                | Execute section; Hermes / MCP active                              |
| `/ingest`                | Pipeline; Ingest YouTube active; locked stubs visible with lock   |
| Megamenu                 | Still opens above the strip                                       |

Also confirm fill-height pages (`/terminal`, transcript split) do not clip oddly after `--content-area-h` change.

- [ ] **Step 4: Commit (only if user asked)**

Skip unless requested. Suggested message if asked:

```bash
git add \
  apps/client/src/lib/nav-menu.utils.ts \
  apps/client/src/lib/nav-menu.utils.test.ts \
  apps/client/src/components/SectionSubnav \
  apps/client/src/layouts/AppLayout/AppLayout.tsx \
  apps/client/src/styles/app.css \
  docs/superpowers/specs/2026-07-28-section-subnav-design.md \
  docs/superpowers/plans/2026-07-28-section-subnav.md
git commit -m "$(cat <<'EOF'
feat(client): add sticky section subnav under main header

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement                                   | Task  |
| -------------------------------------------------- | ----- |
| Subnav under main header, above SecondaryActionBar | 4     |
| Items from `NAV_MENU_SECTIONS`                     | 3     |
| Accent-green active + `aria-current`               | 3     |
| Reserved height when no section                    | 2 + 3 |
| Registry + Knowledge matchers                      | 1     |
| Execute precedence for `/vault/runs`               | 1     |
| Disabled + lock for `live: false`                  | 3     |
| Sticky + `--content-area-h` update                 | 2 + 3 |
| Horizontal overflow scroll (no height jump)        | 3 CSS |
| Labels only (no descriptions)                      | 3     |

## Spec deltas intentionally included

- Execute matchers also cover `/hermes` and `/crons` (otherwise those Execute pages show an empty strip).
- `getActiveNavItemHref` longest-match so Browse Vault (`/vault`) does not stay active on every vault child — required for usable accent-green highlighting.
