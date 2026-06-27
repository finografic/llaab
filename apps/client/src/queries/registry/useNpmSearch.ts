import { useQuery } from '@tanstack/react-query';
import type { NpmSearchResponse } from '@llaab/schemas';

import { apiGet } from 'lib/api-client';

import { REGISTRY_QUERY_KEYS } from './index';

async function fetchNpmSearch(q: string): Promise<NpmSearchResponse> {
  const params = new URLSearchParams({ q, size: '25' });
  return apiGet<NpmSearchResponse>(`/api/registry/npm/search?${params.toString()}`);
}

export function useNpmSearch(query: string) {
  return useQuery({
    queryKey: REGISTRY_QUERY_KEYS.registry.search(query),
    queryFn: () => fetchNpmSearch(query),
    enabled: query.length > 0,
    staleTime: 60_000,
  });
}
