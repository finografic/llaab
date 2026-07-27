/**
 * Evaluates gold queries against the live `knowledge/` and `vault/` corpus.
 *
 * This is the realistic measurement, but it is deliberately not wired to a CI guard: the corpus
 * grows with every ingest, so metrics move for reasons unrelated to ranking. Use it to find real
 * misses; use the frozen corpus to prevent regressions.
 */

import type { RetrievalGoldQuery } from './retrieval-eval.utils.js';

import { searchKnowledgeDocs } from '../utils/search-knowledge-docs.utils.js';
import { searchVaultNodes } from '../utils/search-vault-nodes.utils.js';
import liveGoldSet from './fixtures/live-gold-set.json' with { type: 'json' };
import { documentRef } from './retrieval-eval.utils.js';

/** Retrieve deeper than the largest evaluated `k` so rank positions stay measurable. */
const LIVE_RETRIEVAL_DEPTH = 20;

export function loadLiveGoldQueries(): RetrievalGoldQuery[] {
  return liveGoldSet.queries as RetrievalGoldQuery[];
}

export async function retrieveFromLiveCorpus(query: RetrievalGoldQuery): Promise<string[]> {
  const useKnowledge = query.scope === 'all' || query.scope === 'knowledge';
  const useVault = query.scope === 'all' || query.scope === 'vault';

  const [knowledgeResults, vaultResults] = await Promise.all([
    useKnowledge ? searchKnowledgeDocs({ limit: LIVE_RETRIEVAL_DEPTH, query: query.question }) : [],
    useVault ? searchVaultNodes({ limit: LIVE_RETRIEVAL_DEPTH, query: query.question }) : [],
  ]);

  return [
    ...knowledgeResults.map((result) => ({
      ref: documentRef('knowledge', result.path),
      score: result.score,
    })),
    ...vaultResults.map((result) => ({ ref: documentRef('vault', result.node_id), score: result.score })),
  ]
    .sort((a, b) => b.score - a.score || a.ref.localeCompare(b.ref))
    .map((entry) => entry.ref);
}
