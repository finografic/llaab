import { useQuery } from '@tanstack/react-query';
import type { PackageInstallStatsResponse } from '@llaab/schemas';

import { apiGet } from 'lib/api-client';

import { REGISTRY_QUERY_KEYS } from './index';

async function fetchNpmPackageStats(name: string, version?: string): Promise<PackageInstallStatsResponse> {
  const params = version ? `?version=${encodeURIComponent(version)}` : '';
  return apiGet<PackageInstallStatsResponse>(
    `/api/registry/npm/package/${encodeURIComponent(name)}/stats${params}`,
  );
}

/** Lazy install-size + vuln count (tree walk + OSV). */
export function useNpmPackageStats(name: string, version?: string) {
  return useQuery({
    queryKey: REGISTRY_QUERY_KEYS.registry.packageStats(name, version),
    queryFn: () => fetchNpmPackageStats(name, version),
    enabled: name.length > 0,
    staleTime: 10 * 60_000,
  });
}
