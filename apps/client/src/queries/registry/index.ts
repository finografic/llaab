export const REGISTRY_QUERY_KEYS = {
  registry: {
    all: ['registry'] as const,
    search: (q: string) => [...REGISTRY_QUERY_KEYS.registry.all, 'search', q] as const,
    package: (name: string) => [...REGISTRY_QUERY_KEYS.registry.all, 'package', name] as const,
    pins: () => [...REGISTRY_QUERY_KEYS.registry.all, 'pins'] as const,
    repoSearch: (q: string) => [...REGISTRY_QUERY_KEYS.registry.all, 'repo-search', q] as const,
    repo: (fullName: string) => [...REGISTRY_QUERY_KEYS.registry.all, 'repo', fullName] as const,
    repoPins: () => [...REGISTRY_QUERY_KEYS.registry.all, 'repo-pins'] as const,
  },
};

export { useNpmSearch } from './useNpmSearch';
export { useNpmPackage } from './useNpmPackage';
export { usePinnedLibraries, usePinLibrary, useUnpinLibrary, useIsLibraryPinned } from './usePinnedLibraries';
export { useGithubRepoSearch } from './useGithubRepoSearch';
export { useGithubRepo } from './useGithubRepo';
export {
  usePinnedRepositories,
  usePinRepository,
  useUnpinRepository,
  useIsRepositoryPinned,
} from './usePinnedRepositories';
