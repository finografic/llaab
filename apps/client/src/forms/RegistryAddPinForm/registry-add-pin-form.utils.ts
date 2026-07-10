import { extractDroppedUrl, isHttpUrl } from '../IngestForm/ingest-form.utils';

/** Below this pin count, typing in the search field switches to Search results. */
export const MIN_PINNED = 10;

export type RegistryUrlKind = 'library' | 'repository' | 'unknown';

const NPM_PACKAGE_PATH = /^\/package\/(@[^/]+\/[^/]+|[^/]+)\/?$/i;
const GITHUB_REPO_PATH = /^\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i;

function hostnameOf(value: string): string | null {
  try {
    return new URL(value).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

/** Parse `owner/repo` from a GitHub URL (or bare owner/repo). */
export function parseGithubRepoRef(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (!isHttpUrl(trimmed)) {
    const bare = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
    if (!bare?.[1] || !bare[2]) return null;
    if (bare[1] === '.' || bare[1] === '..') return null;
    return `${bare[1]}/${bare[2].replace(/\.git$/i, '')}`;
  }

  const host = hostnameOf(trimmed);
  if (host !== 'github.com') return null;

  try {
    const { pathname } = new URL(trimmed);
    const match = pathname.match(GITHUB_REPO_PATH);
    if (!match?.[1] || !match[2]) return null;
    const owner = match[1];
    const repo = match[2].replace(/\.git$/i, '');
    if (owner === '.' || owner === '..') return null;
    return `${owner}/${repo}`;
  } catch {
    return null;
  }
}

/** Parse npm package name from an npmjs.com / npmx.dev URL (or bare package name with `/` for scopes). */
export function parseNpmPackageRef(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (!isHttpUrl(trimmed)) {
    // Bare scoped or unscoped package — not a GitHub owner/repo (no single slash without @).
    if (/^@[A-Za-z0-9~-][A-Za-z0-9._~-]*\/[A-Za-z0-9~-][A-Za-z0-9._~-]*$/.test(trimmed)) {
      return trimmed;
    }
    if (/^[A-Za-z0-9~-][A-Za-z0-9._~-]*$/.test(trimmed) && !trimmed.includes('/')) {
      return trimmed;
    }
    return null;
  }

  const host = hostnameOf(trimmed);
  if (host !== 'npmjs.com' && host !== 'npmjs.org' && host !== 'npmx.dev') return null;

  try {
    const { pathname } = new URL(trimmed);
    const match = pathname.match(NPM_PACKAGE_PATH);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function classifyRegistryUrl(value: string): RegistryUrlKind {
  const trimmed = value.trim();
  if (!trimmed) return 'unknown';
  if (parseGithubRepoRef(trimmed)) return 'repository';
  if (parseNpmPackageRef(trimmed)) return 'library';
  return 'unknown';
}

export { extractDroppedUrl, isHttpUrl };
