import { useQuery } from '@tanstack/react-query';
import type { PackageDetailResponse } from '@llaab/schemas';

import { apiGet } from 'lib/api-client';

import { REGISTRY_QUERY_KEYS } from './index';

async function fetchNpmPackage(name: string): Promise<PackageDetailResponse> {
  return apiGet<PackageDetailResponse>(`/api/registry/npm/package/${encodeURIComponent(name)}`);
}

export function useNpmPackage(name: string) {
  return useQuery({
    queryKey: REGISTRY_QUERY_KEYS.registry.package(name),
    queryFn: () => fetchNpmPackage(name),
    enabled: name.length > 0,
    staleTime: 5 * 60_000,
  });
}
