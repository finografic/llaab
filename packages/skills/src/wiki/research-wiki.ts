import { WikiResearchRequestSchema } from '@llaab/schemas';
import type { WikiResearchRequest } from '@llaab/schemas';

import { runSkill } from '../runner.js';

/**
 * Explicit research boundary. Retrieval adapters are intentionally not implicit: this one-shot run
 * records the approved request and leaves evidence review to a subsequent wiki draft workflow.
 */
export async function researchWiki(request: WikiResearchRequest) {
  const approved = WikiResearchRequestSchema.parse(request);
  return runSkill(
    'research-wiki',
    async () => ({
      targetId: approved.wiki_id ?? approved.draft_id!,
      query: approved.query,
      provider: approved.provider,
      maxResults: approved.max_results,
      producedNodeIds: [],
      runTrace: {
        stages: [{ name: 'approve-research', status: 'completed', output: { provider: approved.provider } }],
        decisions: [
          { type: 'accept', reason: 'Research request approved; no retrieval adapter is configured.' },
        ],
      },
    }),
    approved,
  );
}
