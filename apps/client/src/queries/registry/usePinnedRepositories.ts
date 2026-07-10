import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PinnedRepository } from '@llaab/schemas';

import { apiGet, apiPost } from 'lib/api-client';

import { REGISTRY_QUERY_KEYS } from './index';

async function fetchRepoPins(): Promise<PinnedRepository[]> {
  const res = await apiGet<{ pins: PinnedRepository[] }>('/api/registry/repo-pins');
  return res.pins;
}

async function pinRepo(fullName: string): Promise<PinnedRepository> {
  const res = await apiPost<{ pin: PinnedRepository }>('/api/registry/repo-pins', { fullName });
  return res.pin;
}

async function unpinRepo(fullName: string): Promise<void> {
  const [owner, repo] = fullName.split('/');
  if (!owner || !repo) throw new Error('Invalid repository full name');
  await fetch(`/api/registry/repo-pins/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
}

export function usePinnedRepositories() {
  return useQuery({
    queryKey: REGISTRY_QUERY_KEYS.registry.repoPins(),
    queryFn: fetchRepoPins,
    staleTime: 30_000,
  });
}

export function usePinRepository() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fullName: string) => pinRepo(fullName),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: REGISTRY_QUERY_KEYS.registry.repoPins() });
    },
  });
}

export function useUnpinRepository() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fullName: string) => unpinRepo(fullName),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: REGISTRY_QUERY_KEYS.registry.repoPins() });
    },
  });
}

export function useIsRepositoryPinned(fullName: string): boolean {
  const { data: pins = [] } = usePinnedRepositories();
  return pins.some((p) => p.fullName === fullName);
}
