import { useQuery } from '@tanstack/react-query';
import type { RepoDetailResponse } from '@llaab/schemas';

import { apiGet } from 'lib/api-client';

import { REGISTRY_QUERY_KEYS } from './index';

async function fetchGithubRepo(fullName: string): Promise<RepoDetailResponse> {
  const [owner, repo] = fullName.split('/');
  if (!owner || !repo) throw new Error('Invalid repository full name');
  return apiGet<RepoDetailResponse>(
    `/api/registry/github/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
  );
}

export function useGithubRepo(fullName: string) {
  return useQuery({
    queryKey: REGISTRY_QUERY_KEYS.registry.repo(fullName),
    queryFn: () => fetchGithubRepo(fullName),
    enabled: fullName.includes('/'),
    staleTime: 5 * 60_000,
  });
}
