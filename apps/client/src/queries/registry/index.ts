export const REGISTRY_QUERY_KEYS = {
  registry: {
    all: ['registry'] as const,
    search: (q: string) => [...REGISTRY_QUERY_KEYS.registry.all, 'search', q] as const,
    package: (name: string) => [...REGISTRY_QUERY_KEYS.registry.all, 'package', name] as const,
    packageStats: (name: string, version?: string) =>
      [...REGISTRY_QUERY_KEYS.registry.all, 'package-stats', name, version ?? 'latest'] as const,
    packageSocketScores: (name: string, version?: string) =>
      [...REGISTRY_QUERY_KEYS.registry.all, 'package-socket-scores', name, version ?? 'latest'] as const,
    pins: () => [...REGISTRY_QUERY_KEYS.registry.all, 'pins'] as const,
    repoSearch: (q: string) => [...REGISTRY_QUERY_KEYS.registry.all, 'repo-search', q] as const,
    repo: (fullName: string) => [...REGISTRY_QUERY_KEYS.registry.all, 'repo', fullName] as const,
    repoMeta: (fullName: string) => [...REGISTRY_QUERY_KEYS.registry.all, 'repo-meta', fullName] as const,
    repoNpm: (fullName: string) => [...REGISTRY_QUERY_KEYS.registry.all, 'repo-npm', fullName] as const,
    repoPins: () => [...REGISTRY_QUERY_KEYS.registry.all, 'repo-pins'] as const,
  },
};

export { useNpmSearch } from './useNpmSearch';
export { useNpmPackage } from './useNpmPackage';
export { useNpmPackageStats } from './useNpmPackageStats';
export { useNpmPackageSocketScores } from './useNpmPackageSocketScores';
export { usePinnedPackages, usePinPackage, useUnpinPackage, useIsPackagePinned } from './usePinnedPackages';
export { useGithubRepoSearch } from './useGithubRepoSearch';
export { useGithubRepo } from './useGithubRepo';
export { useGithubRepoMeta } from './useGithubRepoMeta';
export { useGithubRepoNpm } from './useGithubRepoNpm';
export {
  usePinnedRepositories,
  usePinRepository,
  useUnpinRepository,
  useIsRepositoryPinned,
} from './usePinnedRepositories';
