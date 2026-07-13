import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { invalidateWikiDraftCaches, QUERY_KEYS } from './wiki-drafts.queries';

describe('wiki draft query caches', () => {
  it('invalidates the draft, vault, and knowledge domains after a review action', async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    await invalidateWikiDraftCaches(queryClient, 'draft-1');

    expect(invalidateQueries).toHaveBeenCalledTimes(3);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: QUERY_KEYS.wikiDrafts.detail('draft-1'),
    });
  });
});
