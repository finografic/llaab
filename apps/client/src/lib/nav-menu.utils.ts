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
