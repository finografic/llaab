import { useQuery } from '@tanstack/react-query';
import type { RepoNpmInfoResponse } from '@llaab/schemas';

import { apiGet } from 'lib/api-client';

import { REGISTRY_QUERY_KEYS } from './index';

async function fetchGithubRepoNpm(fullName: string): Promise<RepoNpmInfoResponse> {
  const [owner, repo] = fullName.split('/');
  if (!owner || !repo) throw new Error('Invalid repository full name');
  return apiGet<RepoNpmInfoResponse>(
    `/api/registry/github/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/npm`,
  );
}

/** Lazy npm package + downloads for a GitHub repo — does not block repo detail. */
export function useGithubRepoNpm(fullName: string) {
  return useQuery({
    queryKey: REGISTRY_QUERY_KEYS.registry.repoNpm(fullName),
    queryFn: () => fetchGithubRepoNpm(fullName),
    enabled: fullName.includes('/'),
    staleTime: 5 * 60_000,
  });
}
