/**
 * Loads the frozen fixture corpus and evaluates it through the real ranking functions.
 *
 * The live vault cannot back a CI regression guard: it grows with every ingest, so metrics move
 * for reasons unrelated to ranking. This corpus is fixed, so any metric change is caused by a
 * ranking change and nothing else.
 */

import type { KnowledgeDoc } from '../utils/search-knowledge-docs.utils.js';
import type { RetrievalGoldQuery, RetrievalTier } from './retrieval-eval.utils.js';
import type { LabNode, NodeStatus, NodeType } from '@llaab/schemas';

import { rankKnowledgeDocs } from '../utils/search-knowledge-docs.utils.js';
import { rankVaultSearchNodes } from '../utils/search-vault-nodes.utils.js';
import frozenCorpus from './fixtures/frozen-corpus.json' with { type: 'json' };
import frozenGoldSet from './fixtures/frozen-gold-set.json' with { type: 'json' };
import { documentRef } from './retrieval-eval.utils.js';

interface FrozenDocument {
  tier: string;
  id: string;
  title: string;
  tags: string[];
  body: string;
}

const FROZEN_NODE_DATE = '2026-01-01T00:00:00.000Z';
/** Retrieve deeper than the largest evaluated `k` so rank positions stay measurable. */
const FROZEN_RETRIEVAL_DEPTH = 20;

export function loadFrozenGoldQueries(): RetrievalGoldQuery[] {
  return frozenGoldSet.queries as RetrievalGoldQuery[];
}

export function loadFrozenDocuments(): FrozenDocument[] {
  return frozenCorpus.documents as FrozenDocument[];
}

/**
 * Ranks the frozen corpus for one gold query, honouring its scope, and returns tier-qualified
 * references best-first. Tiers are ranked separately (as `chat.ask` does) and interleaved by score
 * so a single ordered list can be scored.
 */
export function retrieveFromFrozenCorpus(query: RetrievalGoldQuery): string[] {
  const documents = loadFrozenDocuments();
  const useKnowledge = query.scope === 'all' || query.scope === 'knowledge';
  const useVault = query.scope === 'all' || query.scope === 'vault';

  const knowledgeResults = useKnowledge
    ? rankKnowledgeDocs(documents.filter((document) => document.tier === 'knowledge').map(toKnowledgeDoc), {
        limit: FROZEN_RETRIEVAL_DEPTH,
        query: query.question,
      }).map((result) => ({ ref: documentRef('knowledge', result.path), score: result.score }))
    : [];

  const vaultResults = useVault
    ? rankVaultSearchNodes(documents.filter((document) => document.tier === 'vault').map(toLabNode), {
        limit: FROZEN_RETRIEVAL_DEPTH,
        query: query.question,
      }).map((result) => ({ ref: documentRef('vault', result.node_id), score: result.score }))
    : [];

  return [...knowledgeResults, ...vaultResults]
    .sort((a, b) => b.score - a.score || a.ref.localeCompare(b.ref))
    .map((entry) => entry.ref);
}

export function frozenTierOf(document: FrozenDocument): RetrievalTier {
  return document.tier === 'knowledge' ? 'knowledge' : 'vault';
}

function toKnowledgeDoc(document: FrozenDocument): KnowledgeDoc {
  const [collection = 'wikis'] = document.id.split('/');
  return {
    body: document.body,
    collection,
    id: document.id.replace(/^.*\//, '').replace(/\.md$/, ''),
    path: document.id,
    tags: document.tags,
    title: document.title,
  };
}

function toLabNode(document: FrozenDocument): LabNode {
  return {
    body: document.body,
    created_at: FROZEN_NODE_DATE,
    id: document.id,
    related: [],
    status: 'seed' as NodeStatus,
    tags: document.tags,
    title: document.title,
    type: 'idea' as NodeType,
  } as LabNode;
}
