import { useQuery } from '@tanstack/react-query';
import type { PackageSocketScoresResponse } from '@llaab/schemas';

import { apiGet } from 'lib/api-client';

import { REGISTRY_QUERY_KEYS } from './index';

async function fetchNpmPackageSocketScores(
  name: string,
  version?: string,
): Promise<PackageSocketScoresResponse> {
  const params = version && version !== 'latest' ? `?version=${encodeURIComponent(version)}` : '';
  return apiGet<PackageSocketScoresResponse>(
    `/api/registry/npm/package/${encodeURIComponent(name)}/socket-scores${params}`,
  );
}

/** Lazy Socket.dev scores — no-op UI when SOCKET_API_TOKEN is unset. */
export function useNpmPackageSocketScores(name: string, version?: string) {
  return useQuery({
    queryKey: REGISTRY_QUERY_KEYS.registry.packageSocketScores(name, version),
    queryFn: () => fetchNpmPackageSocketScores(name, version),
    enabled: name.length > 0,
    staleTime: 30 * 60_000,
  });
}
