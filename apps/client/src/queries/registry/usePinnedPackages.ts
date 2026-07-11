import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PinnedPackage } from '@llaab/schemas';

import { apiGet, apiPost } from 'lib/api-client';

import { REGISTRY_QUERY_KEYS } from './index';

async function fetchPins(): Promise<PinnedPackage[]> {
  const res = await apiGet<{ pins: PinnedPackage[] }>('/api/registry/pins');
  return res.pins;
}

async function pinPackage(name: string): Promise<PinnedPackage> {
  const res = await apiPost<{ pin: PinnedPackage }>('/api/registry/pins', { name });
  return res.pin;
}

async function unpinPackage(name: string): Promise<void> {
  await fetch(`/api/registry/pins/${encodeURIComponent(name)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
}

export function usePinnedPackages() {
  return useQuery({
    queryKey: REGISTRY_QUERY_KEYS.registry.pins(),
    queryFn: fetchPins,
    staleTime: 30_000,
  });
}

export function usePinPackage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => pinPackage(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: REGISTRY_QUERY_KEYS.registry.pins() });
    },
  });
}

export function useUnpinPackage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => unpinPackage(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: REGISTRY_QUERY_KEYS.registry.pins() });
    },
  });
}

export function useIsPackagePinned(name: string): boolean {
  const { data: pins = [] } = usePinnedPackages();
  return pins.some((p) => p.name === name);
}
