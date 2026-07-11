import { useQuery } from '@tanstack/react-query';
import type { RepoMetaResponse } from '@llaab/schemas';

import { apiGet } from 'lib/api-client';

import { REGISTRY_QUERY_KEYS } from './index';

async function fetchGithubRepoMeta(fullName: string): Promise<RepoMetaResponse> {
  const [owner, repo] = fullName.split('/');
  if (!owner || !repo) throw new Error('Invalid repository full name');
  return apiGet<RepoMetaResponse>(
    `/api/registry/github/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/meta`,
  );
}

/** Slim GitHub meta (stars / issues) — does not block package detail. */
export function useGithubRepoMeta(fullName: string) {
  return useQuery({
    queryKey: REGISTRY_QUERY_KEYS.registry.repoMeta(fullName),
    queryFn: () => fetchGithubRepoMeta(fullName),
    enabled: fullName.includes('/'),
    staleTime: 5 * 60_000,
  });
}
