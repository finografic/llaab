import type { AppCtx, AppCtxQuery } from '../../types/app.types.js';
import type { SearchQuery } from './registry.schema.js';
import type { PackageDetailResponse, PackageMetaResponse, NpmDownloadCount } from '@llaab/schemas';

const NPM_REGISTRY = 'https://registry.npmjs.org';
const NPM_API = 'https://api.npmjs.org';

function encodePackageName(name: string): string {
  // Scoped packages: @scope/name → @scope%2Fname
  return name.startsWith('@') ? `@${encodeURIComponent(name.slice(1))}` : name;
}

function normalizeAuthor(raw: unknown): PackageMetaResponse['author'] {
  if (!raw) return undefined;
  if (typeof raw === 'string') return { name: raw };
  const a = raw as { name?: string; email?: string; url?: string };
  return { name: a.name, email: a.email, url: a.url };
}

function normalizeLicense(raw: unknown): string | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string') return raw;
  return (raw as { type?: string }).type;
}

function normalizeRepoUrl(raw: unknown): string | undefined {
  if (!raw) return undefined;
  const url = typeof raw === 'string' ? raw : (raw as { url?: string }).url;
  if (!url) return undefined;
  return url
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/\.git$/, '');
}

function normalizeBugsUrl(raw: unknown): string | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string') return raw;
  return (raw as { url?: string }).url;
}

async function fetchPackageMeta(name: string): Promise<PackageMetaResponse> {
  const encoded = encodePackageName(name);

  const [packument, downloads] = await Promise.all([
    fetch(`${NPM_REGISTRY}/${encoded}`).then((r) => {
      if (!r.ok) throw new Error(`npm registry error: ${r.status}`);
      return r.json() as Promise<Record<string, unknown>>;
    }),
    fetch(`${NPM_API}/downloads/point/last-week/${encoded}`)
      .then((r) => (r.ok ? (r.json() as Promise<NpmDownloadCount>) : null))
      .catch(() => null),
  ]);

  const distTags = (packument['dist-tags'] ?? {}) as Record<string, string>;
  const latestVersion = distTags.latest ?? Object.values(distTags)[0] ?? '';
  const time = (packument.time ?? {}) as Record<string, string>;
  const date = time[latestVersion] ?? time.modified ?? '';

  return {
    name: packument.name as string,
    version: latestVersion,
    description: packument.description as string | undefined,
    keywords: packument.keywords as string[] | undefined,
    license: normalizeLicense(packument.license),
    date,
    links: {
      npm: `https://www.npmjs.com/package/${packument.name as string}`,
      homepage: packument.homepage as string | undefined,
      repository: normalizeRepoUrl(packument.repository),
      bugs: normalizeBugsUrl(packument.bugs),
    },
    author: normalizeAuthor(packument.author),
    maintainers: (packument.maintainers as PackageMetaResponse['maintainers']) ?? undefined,
    weeklyDownloads: downloads?.downloads,
  };
}

function extractReadme(packument: Record<string, unknown>, version: string): string | null {
  const versions = (packument.versions ?? {}) as Record<string, Record<string, unknown>>;
  return (
    (packument.readme as string | undefined) ?? (versions[version]?.readme as string | undefined) ?? null
  );
}

export const npmSearch = {
  path: '/npm/search' as const,
  handler: async (c: AppCtxQuery<SearchQuery>) => {
    const { q, size, from } = c.req.valid('query');
    const params = new URLSearchParams({ text: q, size: String(size), from: String(from) });

    try {
      const res = await fetch(`${NPM_REGISTRY}/-/v1/search?${params.toString()}`);
      if (!res.ok) return c.json({ error: 'npm search failed' }, 502);
      const data = await res.json();
      return c.json(data);
    } catch {
      return c.json({ error: 'npm search unavailable' }, 502);
    }
  },
};

export const npmPackage = {
  path: '/npm/package/:name' as const,
  handler: async (c: AppCtx) => {
    const name = c.req.param('name') ?? '';
    const decoded = decodeURIComponent(name);

    try {
      const encoded = encodePackageName(decoded);
      const [packument, downloads] = await Promise.all([
        fetch(`${NPM_REGISTRY}/${encoded}`).then((r) => {
          if (!r.ok) throw new Error(`npm registry error: ${r.status}`);
          return r.json() as Promise<Record<string, unknown>>;
        }),
        fetch(`${NPM_API}/downloads/point/last-week/${encoded}`)
          .then((r) => (r.ok ? (r.json() as Promise<NpmDownloadCount>) : null))
          .catch(() => null),
      ]);

      const distTags = (packument['dist-tags'] ?? {}) as Record<string, string>;
      const latestVersion = distTags.latest ?? Object.values(distTags)[0] ?? '';
      const time = (packument.time ?? {}) as Record<string, string>;
      const date = time[latestVersion] ?? time.modified ?? '';

      const meta: PackageMetaResponse = {
        name: packument.name as string,
        version: latestVersion,
        description: packument.description as string | undefined,
        keywords: packument.keywords as string[] | undefined,
        license: normalizeLicense(packument.license),
        date,
        links: {
          npm: `https://www.npmjs.com/package/${packument.name as string}`,
          homepage: packument.homepage as string | undefined,
          repository: normalizeRepoUrl(packument.repository),
          bugs: normalizeBugsUrl(packument.bugs),
        },
        author: normalizeAuthor(packument.author),
        maintainers: (packument.maintainers as PackageMetaResponse['maintainers']) ?? undefined,
        weeklyDownloads: downloads?.downloads,
      };

      const detail: PackageDetailResponse = {
        ...meta,
        readme: extractReadme(packument, latestVersion),
      };

      return c.json(detail);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Package fetch failed';
      return c.json({ error: message }, 502);
    }
  },
};

export { fetchPackageMeta };
