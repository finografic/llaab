const SECTION_MATCHERS: Array<{ id: string; matches: (pathname: string) => boolean }> = [
  {
    id: 'execute',
    matches: (pathname) =>
      pathname.startsWith('/vault/runs') ||
      pathname.startsWith('/agent') ||
      pathname.startsWith('/terminal') ||
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
