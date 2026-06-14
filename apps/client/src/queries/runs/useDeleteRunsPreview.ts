import { useMutation } from '@tanstack/react-query';

import { previewDeleteVaultRuns } from 'lib/api';

export interface DeleteRunsPreviewNode {
  id: string;
  type: string;
  title: string;
}

export interface DeleteRunsPreviewPreservedNode extends DeleteRunsPreviewNode {
  reason: string;
}

export interface DeleteRunsPreviewCanonicalIdea {
  id: string;
  title: string;
  transcriptId?: string;
}

export interface DeleteRunsPreviewResult {
  runs: Array<{ id: string; title: string }>;
  toDelete: DeleteRunsPreviewNode[];
  preserved: DeleteRunsPreviewPreservedNode[];
  canonicalIdeasAffected: DeleteRunsPreviewCanonicalIdea[];
}

/** Preview which produced nodes a run/batch delete would remove vs. preserve. */
export function useDeleteRunsPreview() {
  return useMutation({
    mutationFn: async (ids: string[]): Promise<DeleteRunsPreviewResult> => {
      const res = await previewDeleteVaultRuns(ids);
      const body = (await res.json().catch(() => null)) as
        | (DeleteRunsPreviewResult & { error?: string })
        | null;

      if (!res.ok) {
        throw new Error(body?.error ?? 'Failed to preview run delete.');
      }

      return {
        runs: body?.runs ?? [],
        toDelete: body?.toDelete ?? [],
        preserved: body?.preserved ?? [],
        canonicalIdeasAffected: body?.canonicalIdeasAffected ?? [],
      };
    },
  });
}
