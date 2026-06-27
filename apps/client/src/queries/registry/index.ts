export const REGISTRY_QUERY_KEYS = {
  registry: {
    all: ['registry'] as const,
    search: (q: string) => [...REGISTRY_QUERY_KEYS.registry.all, 'search', q] as const,
    package: (name: string) => [...REGISTRY_QUERY_KEYS.registry.all, 'package', name] as const,
    pins: () => [...REGISTRY_QUERY_KEYS.registry.all, 'pins'] as const,
  },
};

export { useNpmSearch } from './useNpmSearch';
export { useNpmPackage } from './useNpmPackage';
export { usePinnedLibraries, usePinLibrary, useUnpinLibrary, useIsLibraryPinned } from './usePinnedLibraries';
