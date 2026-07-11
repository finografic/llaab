import type { AppCtx, AppCtxQuery } from '../../types/app.types.js';
import type { SearchQuery } from './registry.schema.js';
import type {
  GithubRepoSearchItem,
  GithubRepoSearchResponse,
  RepoDetailResponse,
  RepoLanguageShare,
  RepoMetaResponse,
} from '@llaab/schemas';

import { renderReadmeToHtml } from '../../lib/readme-renderer.js';

const GITHUB_API = 'https://api.github.com';

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

function normalizeLicense(raw: unknown): string | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const spdx = (raw as { spdx_id?: string | null }).spdx_id;
  if (spdx && spdx !== 'NOASSERTION') return spdx;
  const name = (raw as { name?: string | null }).name;
  return name ?? undefined;
}

function mapSearchItem(raw: Record<string, unknown>): GithubRepoSearchItem {
  const ownerLogin = (raw.owner as { login?: string } | null)?.login ?? '';
  const fullName = (raw.full_name as string) ?? `${ownerLogin}/${raw.name as string}`;
  const [ownerFromFullName = '', nameFromFullName = ''] = fullName.split('/');
  return {
    fullName,
    name: (raw.name as string) ?? nameFromFullName,
    owner: ownerLogin || ownerFromFullName,
    description: (raw.description as string | null) ?? undefined,
    topics: (raw.topics as string[] | undefined) ?? [],
    language: (raw.language as string | null) ?? null,
    stars: (raw.stargazers_count as number) ?? 0,
    forks: (raw.forks_count as number) ?? 0,
    openIssues: (raw.open_issues_count as number) ?? 0,
    license: normalizeLicense(raw.license),
    updatedAt: (raw.updated_at as string) ?? '',
    pushedAt: (raw.pushed_at as string | null) ?? undefined,
    htmlUrl: (raw.html_url as string) ?? `https://github.com/${fullName}`,
    homepage: (raw.homepage as string | null) ?? null,
    archived: Boolean(raw.archived),
    fork: Boolean(raw.fork),
  };
}

function mapRepoMeta(raw: Record<string, unknown>): RepoMetaResponse {
  const item = mapSearchItem(raw);
  return {
    fullName: item.fullName,
    name: item.name,
    owner: item.owner,
    description: item.description,
    topics: item.topics,
    language: item.language,
    stars: item.stars,
    forks: item.forks,
    openIssues: item.openIssues,
    license: item.license,
    updatedAt: item.updatedAt,
    pushedAt: item.pushedAt,
    htmlUrl: item.htmlUrl,
    homepage: item.homepage,
    defaultBranch: (raw.default_branch as string | undefined) ?? undefined,
  };
}

function toLanguageShares(languages: Record<string, number>): RepoLanguageShare[] {
  const total = Object.values(languages).reduce((sum, n) => sum + n, 0);
  if (total <= 0) return [];
  return Object.entries(languages)
    .map(([name, bytes]) => ({
      name,
      bytes,
      percent: Math.round((bytes / total) * 1000) / 10,
    }))
    .sort((a, b) => b.bytes - a.bytes);
}

async function fetchRepoJson(owner: string, repo: string): Promise<Record<string, unknown>> {
  const res = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json() as Promise<Record<string, unknown>>;
}

async function fetchReadmeMarkdown(owner: string, repo: string): Promise<string | null> {
  const res = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`, {
    headers: { Accept: 'application/vnd.github.raw+json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return res.text();
}

async function fetchLanguages(owner: string, repo: string): Promise<Record<string, number>> {
  const res = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/languages`);
  if (!res.ok) return {};
  return (await res.json()) as Record<string, number>;
}

async function fetchLatestVersion(owner: string, repo: string): Promise<string | undefined> {
  const releaseRes = await githubFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/latest`,
  );
  if (releaseRes.ok) {
    const release = (await releaseRes.json()) as { tag_name?: string };
    if (release.tag_name) return release.tag_name;
  }

  const tagsRes = await githubFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tags?per_page=1`,
  );
  if (!tagsRes.ok) return undefined;

  const tags = (await tagsRes.json()) as Array<{ name?: string }>;
  return tags[0]?.name;
}

export async function fetchRepoMeta(fullName: string): Promise<RepoMetaResponse> {
  const [owner, repo] = fullName.split('/');
  if (!owner || !repo) throw new Error('Invalid repository full name');
  const raw = await fetchRepoJson(owner, repo);
  return mapRepoMeta(raw);
}

export const githubSearch = {
  path: '/github/search' as const,
  handler: async (c: AppCtxQuery<SearchQuery>) => {
    const { q, size, from } = c.req.valid('query');
    const perPage = Math.min(Math.max(size, 1), 50);
    const page = Math.floor(from / perPage) + 1;

    try {
      const params = new URLSearchParams({
        q,
        per_page: String(perPage),
        page: String(page),
      });
      const res = await githubFetch(`/search/repositories?${params.toString()}`);
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return c.json({ error: `GitHub search failed: ${res.status}`, detail: body.slice(0, 200) }, 502);
      }
      const data = (await res.json()) as {
        total_count: number;
        incomplete_results: boolean;
        items: Array<Record<string, unknown>>;
      };
      const payload: GithubRepoSearchResponse = {
        total: data.total_count,
        incomplete: data.incomplete_results,
        items: data.items.map(mapSearchItem),
      };
      return c.json(payload);
    } catch {
      return c.json({ error: 'GitHub search unavailable' }, 502);
    }
  },
};

export const githubRepo = {
  path: '/github/repo/:owner/:repo' as const,
  handler: async (c: AppCtx) => {
    const owner = decodeURIComponent(c.req.param('owner') ?? '');
    const repo = decodeURIComponent(c.req.param('repo') ?? '');
    if (!owner || !repo) return c.json({ error: 'Missing owner/repo' }, 400);

    try {
      const [raw, readmeMd, languages, latestVersion] = await Promise.all([
        fetchRepoJson(owner, repo),
        fetchReadmeMarkdown(owner, repo),
        fetchLanguages(owner, repo),
        fetchLatestVersion(owner, repo),
      ]);

      const meta = mapRepoMeta(raw);
      const readmeHtml = readmeMd ? await renderReadmeToHtml(readmeMd) : null;

      const detail: RepoDetailResponse = {
        ...meta,
        readmeHtml,
        languages: toLanguageShares(languages),
        latestVersion,
        watchers: (raw.subscribers_count as number) ?? (raw.watchers_count as number) ?? 0,
        sizeKb: (raw.size as number) ?? 0,
        createdAt: (raw.created_at as string) ?? '',
        isPrivate: Boolean(raw.private),
        isArchived: Boolean(raw.archived),
        isFork: Boolean(raw.fork),
        isTemplate: Boolean(raw.is_template),
      };

      return c.json(detail);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Repository fetch failed';
      return c.json({ error: message }, 502);
    }
  },
};
