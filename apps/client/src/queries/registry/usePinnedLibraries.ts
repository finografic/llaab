import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PinnedLibrary } from '@llaab/schemas';

import { apiGet, apiPost } from 'lib/api-client';

import { REGISTRY_QUERY_KEYS } from './index';

async function fetchPins(): Promise<PinnedLibrary[]> {
  const res = await apiGet<{ pins: PinnedLibrary[] }>('/api/registry/pins');
  return res.pins;
}

async function pinPackage(name: string): Promise<PinnedLibrary> {
  const res = await apiPost<{ pin: PinnedLibrary }>('/api/registry/pins', { name });
  return res.pin;
}

async function unpinPackage(name: string): Promise<void> {
  await fetch(`/api/registry/pins/${encodeURIComponent(name)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
}

export function usePinnedLibraries() {
  return useQuery({
    queryKey: REGISTRY_QUERY_KEYS.registry.pins(),
    queryFn: fetchPins,
    staleTime: 30_000,
  });
}

export function usePinLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => pinPackage(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: REGISTRY_QUERY_KEYS.registry.pins() });
    },
  });
}

export function useUnpinLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => unpinPackage(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: REGISTRY_QUERY_KEYS.registry.pins() });
    },
  });
}

export function useIsLibraryPinned(name: string): boolean {
  const { data: pins = [] } = usePinnedLibraries();
  return pins.some((p) => p.name === name);
}
