import { useQuery } from '@tanstack/react-query';
import type { GithubRepoSearchResponse } from '@llaab/schemas';

import { apiGet } from 'lib/api-client';

import { REGISTRY_QUERY_KEYS } from './index';

async function fetchGithubRepoSearch(q: string): Promise<GithubRepoSearchResponse> {
  const params = new URLSearchParams({ q, size: '25' });
  return apiGet<GithubRepoSearchResponse>(`/api/registry/github/search?${params.toString()}`);
}

export function useGithubRepoSearch(query: string) {
  return useQuery({
    queryKey: REGISTRY_QUERY_KEYS.registry.repoSearch(query),
    queryFn: () => fetchGithubRepoSearch(query),
    enabled: query.length > 0,
    staleTime: 60_000,
  });
}
