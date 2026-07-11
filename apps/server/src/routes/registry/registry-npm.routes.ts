import type { AppCtx, AppCtxQuery } from '../../types/app.types.js';
import type { SearchQuery } from './registry.schema.js';
import type {
  NpmDownloadCount,
  PackageDetailResponse,
  PackageMetaResponse,
  PackageTypesStatus,
} from '@llaab/schemas';

import { renderReadmeToHtml } from '../../lib/readme-renderer.js';
import { fetchPackageInstallStats } from '../../lib/registry/package-install-stats.js';
import { fetchPackageSocketScores, isSocketConfigured } from '../../lib/registry/package-socket-scores.js';

const NPM_REGISTRY = 'https://registry.npmjs.org';
const NPM_API = 'https://api.npmjs.org';
const GITHUB_API = 'https://api.github.com';

function encodePackageName(name: string): string {
  // Scoped packages: @scope/name → @scope%2Fname
  return name.startsWith('@') ? `@${encodeURIComponent(name.slice(1))}` : name;
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'llaab-registry',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function githubFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: { ...githubHeaders(), ...(init?.headers as Record<string, string> | undefined) },
  });
}

/** Last-week downloads + WoW % change vs the prior 7-day window. */
async function fetchWeeklyDownloads(encodedName: string): Promise<{
  weeklyDownloads?: number;
  weeklyDownloadsChangePercent?: number;
}> {
  try {
    const currentRes = await fetch(`${NPM_API}/downloads/point/last-week/${encodedName}`);
    if (!currentRes.ok) return {};
    const current = (await currentRes.json()) as NpmDownloadCount;
    const weeklyDownloads = current.downloads;

    let weeklyDownloadsChangePercent: number | undefined;
    if (current.start && current.end && current.downloads > 0) {
      const start = new Date(`${current.start}T00:00:00.000Z`);
      const end = new Date(`${current.end}T00:00:00.000Z`);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
        const dayMs = 86_400_000;
        const prevStart = new Date(start.getTime() - 7 * dayMs).toISOString().slice(0, 10);
        const prevEnd = new Date(end.getTime() - 7 * dayMs).toISOString().slice(0, 10);
        const prevRes = await fetch(`${NPM_API}/downloads/point/${prevStart}:${prevEnd}/${encodedName}`);
        if (prevRes.ok) {
          const prev = (await prevRes.json()) as NpmDownloadCount;
          if (typeof prev.downloads === 'number' && prev.downloads > 0) {
            weeklyDownloadsChangePercent =
              Math.round(((current.downloads - prev.downloads) / prev.downloads) * 1000) / 10;
          }
        }
      }
    }

    return {
      weeklyDownloads,
      ...(weeklyDownloadsChangePercent != null ? { weeklyDownloadsChangePercent } : {}),
    };
  } catch {
    return {};
  }
}

function getTypesPackageName(packageName: string): string {
  if (packageName.startsWith('@')) {
    // @scope/name → @types/scope__name
    return `@types/${packageName.slice(1).replace('/', '__')}`;
  }
  return `@types/${packageName}`;
}

function exportsDeclareTypes(exportsField: unknown): boolean {
  if (!exportsField || typeof exportsField !== 'object') return false;

  const visit = (node: unknown): boolean => {
    if (!node || typeof node !== 'object') return false;
    if (Array.isArray(node)) return node.some(visit);
    const record = node as Record<string, unknown>;
    if (typeof record.types === 'string' || typeof record.typings === 'string') return true;
    return Object.values(record).some(visit);
  };

  return visit(exportsField);
}

function hasBundledTypes(versionManifest: Record<string, unknown>): boolean {
  if (typeof versionManifest.types === 'string' || typeof versionManifest.typings === 'string') {
    return true;
  }
  return exportsDeclareTypes(versionManifest.exports);
}

async function typesPackageExists(packageName: string): Promise<string | null> {
  const typesName = getTypesPackageName(packageName);
  try {
    const res = await fetch(`${NPM_REGISTRY}/${encodePackageName(typesName)}`, {
      method: 'HEAD',
    });
    return res.ok ? typesName : null;
  } catch {
    return null;
  }
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

function parseGitHubRepoUrl(url: string | undefined): { owner: string; repo: string } | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./u, '');
    if (hostname !== 'github.com') return null;

    const [owner, repo] = parsed.pathname.split('/').filter(Boolean);
    if (!owner || !repo) return null;

    return { owner, repo: repo.replace(/\.git$/u, '') };
  } catch {
    return null;
  }
}

async function fetchGitHubReadmeMarkdown(repositoryUrl: string | undefined): Promise<string | null> {
  const repoRef = parseGitHubRepoUrl(repositoryUrl);
  if (!repoRef) return null;

  const res = await githubFetch(
    `/repos/${encodeURIComponent(repoRef.owner)}/${encodeURIComponent(repoRef.repo)}/readme`,
    { headers: { Accept: 'application/vnd.github.raw+json' } },
  );
  if (!res.ok) return null;

  const text = await res.text();
  return text.trim() ? text : null;
}

async function renderPackageReadme(
  packument: Record<string, unknown>,
  version: string,
): Promise<string | null> {
  const rawReadme = extractRawReadme(packument, version);
  if (rawReadme?.trim()) {
    return renderReadmeToHtml(rawReadme);
  }

  return fetchGitHubReadmeMarkdown(normalizeRepoUrl(packument.repository)).then((fallbackReadme) =>
    fallbackReadme ? renderReadmeToHtml(fallbackReadme) : null,
  );
}

async function fetchPackageMeta(name: string): Promise<PackageMetaResponse> {
  const encoded = encodePackageName(name);

  const [packument, downloadStats] = await Promise.all([
    fetch(`${NPM_REGISTRY}/${encoded}`).then((r) => {
      if (!r.ok) throw new Error(`npm registry error: ${r.status}`);
      return r.json() as Promise<Record<string, unknown>>;
    }),
    fetchWeeklyDownloads(encoded),
  ]);

  const distTags = (packument['dist-tags'] ?? {}) as Record<string, string>;
  const latestVersion = distTags.latest ?? Object.values(distTags)[0] ?? '';
  const time = (packument.time ?? {}) as Record<string, string>;
  const date = time[latestVersion] ?? time.modified ?? '';
  const versionMeta = await extractVersionMeta(packument, latestVersion);

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
    weeklyDownloads: downloadStats.weeklyDownloads,
    weeklyDownloadsChangePercent: downloadStats.weeklyDownloadsChangePercent,
    typesStatus: versionMeta.typesStatus,
    typesPackageName: versionMeta.typesPackageName,
  };
}

function extractRawReadme(packument: Record<string, unknown>, version: string): string | null {
  const versions = (packument.versions ?? {}) as Record<string, Record<string, unknown>>;
  const readme =
    (packument.readme as string | undefined) ?? (versions[version]?.readme as string | undefined);

  return readme?.trim() ? readme : null;
}

async function extractVersionMeta(packument: Record<string, unknown>, version: string) {
  const versions = (packument.versions ?? {}) as Record<string, Record<string, unknown>>;
  const v = versions[version] ?? {};
  const packageName = (packument.name as string | undefined) ?? '';
  const dist = (v.dist ?? {}) as { unpackedSize?: number };

  let typesStatus: PackageTypesStatus = 'none';
  let typesPackageName: string | undefined;

  if (hasBundledTypes(v)) {
    typesStatus = 'included';
  } else if (packageName) {
    const found = await typesPackageExists(packageName);
    if (found) {
      typesStatus = 'declarations';
      typesPackageName = found;
    }
  }

  return {
    dependencies: (v.dependencies ?? {}) as Record<string, string>,
    peerDependencies: (v.peerDependencies ?? {}) as Record<string, string>,
    hasTypes: typesStatus !== 'none',
    typesStatus,
    typesPackageName,
    isEsm: v.type === 'module',
    unpackedSize: typeof dist.unpackedSize === 'number' ? dist.unpackedSize : undefined,
  };
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
      const [packument, downloadStats] = await Promise.all([
        fetch(`${NPM_REGISTRY}/${encoded}`).then((r) => {
          if (!r.ok) throw new Error(`npm registry error: ${r.status}`);
          return r.json() as Promise<Record<string, unknown>>;
        }),
        fetchWeeklyDownloads(encoded),
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
        weeklyDownloads: downloadStats.weeklyDownloads,
        weeklyDownloadsChangePercent: downloadStats.weeklyDownloadsChangePercent,
      };

      const [versionMeta, readmeHtml] = await Promise.all([
        extractVersionMeta(packument, latestVersion),
        renderPackageReadme(packument, latestVersion),
      ]);

      const detail: PackageDetailResponse = {
        ...meta,
        readmeHtml,
        ...versionMeta,
      };

      return c.json(detail);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Package fetch failed';
      return c.json({ error: message }, 502);
    }
  },
};

/** Lazy install-size + vuln count (npmx-style tree walk). */
export const npmPackageStats = {
  path: '/npm/package/:name/stats' as const,
  handler: async (c: AppCtx) => {
    const name = c.req.param('name') ?? '';
    const decoded = decodeURIComponent(name);
    const version = c.req.query('version') || undefined;

    try {
      const stats = await fetchPackageInstallStats(decoded, version);
      return c.json(stats);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Package stats failed';
      return c.json({ error: message }, 502);
    }
  },
};

/** Lazy Socket.dev category scores (requires SOCKET_API_TOKEN). */
export const npmPackageSocketScores = {
  path: '/npm/package/:name/socket-scores' as const,
  handler: async (c: AppCtx) => {
    const name = c.req.param('name') ?? '';
    const decoded = decodeURIComponent(name);
    const requestedVersion = c.req.query('version') || undefined;

    if (!isSocketConfigured()) {
      return c.json({ configured: false });
    }

    try {
      let version = requestedVersion;
      if (!version || version === 'latest') {
        const meta = await fetchPackageMeta(decoded);
        version = meta.version;
      }
      if (!version) {
        return c.json({ error: 'No version found' }, 404);
      }
      const scores = await fetchPackageSocketScores(decoded, version);
      return c.json(scores);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Socket scores failed';
      return c.json({ error: message }, 502);
    }
  },
};

export { fetchPackageMeta, fetchWeeklyDownloads };
