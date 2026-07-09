import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { LabNode, ResourceType } from '@llaab/schemas';

import { apiPatch, apiPost } from 'lib/api-client';
import { withInboxReviewState } from 'lib/inbox-review.utils';

import { QUERY_KEYS } from './index';

export interface PromoteInboxCaptureInput {
  captureId: string;
  captureTags: string[];
  title: string;
  url?: string;
  resourceType: ResourceType;
  description?: string;
  tags: string[];
  body?: string;
}

export interface PromoteInboxCaptureResult {
  resource: { id: string; path: string; type: string };
  capture: LabNode;
}

/** Promote an inbox capture to a ResourceNode and mark the capture promoted. */
export function usePromoteInboxCapture() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PromoteInboxCaptureInput): Promise<PromoteInboxCaptureResult> => {
      const created = await apiPost<{ id: string; path: string; type: string }>('/api/vault/nodes/resource', {
        type: 'resource',
        title: input.title,
        body: input.body,
        tags: [...input.tags, 'promoted-from-inbox', `from-inbox:${input.captureId}`],
        url: input.url,
        resource_type: input.resourceType,
        description: input.description,
        related: [input.captureId],
      });

      const patched = await apiPatch<{ node: LabNode }>(
        '/api/vault/nodes/' + encodeURIComponent(input.captureId),
        {
          tags: withInboxReviewState(
            [
              ...input.captureTags.filter((tag) => !tag.startsWith('to-resource:')),
              `to-resource:${created.id}`,
            ],
            'promoted',
          ),
        },
      );

      return { resource: created, capture: patched.node };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vault.all });
    },
  });
}
