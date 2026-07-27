import { describe, expect, it } from 'vitest';
import type { LabNode, NodeStatus, NodeType } from '@llaab/schemas';

import { buildVaultContextPackets, rankVaultSearchNodes } from '../utils/search-vault-nodes.utils.js';
import baseline from './fixtures/retrieval-baseline.json' with { type: 'json' };
import {
  loadFrozenDocuments,
  loadFrozenGoldQueries,
  retrieveFromFrozenCorpus,
} from './frozen-corpus.utils.js';
import {
  compareToBaseline,
  documentRef,
  evaluateRetrieval,
  parseDocumentRef,
} from './retrieval-eval.utils.js';

describe('document references', () => {
  it('round-trips a tier-qualified reference', () => {
    expect(parseDocumentRef(documentRef('knowledge', 'wikis/a.md'))).toEqual({
      id: 'wikis/a.md',
      tier: 'knowledge',
    });
  });

  it('preserves ids containing a colon', () => {
    expect(parseDocumentRef('vault:idea:nested:id')).toEqual({ id: 'idea:nested:id', tier: 'vault' });
  });

  it('rejects an unknown tier', () => {
    expect(parseDocumentRef('other:thing')).toBeNull();
    expect(parseDocumentRef('no-separator')).toBeNull();
  });
});

describe('retrieval evaluation', () => {
  it('excludes known misses from aggregates but still reports them', async () => {
    const report = await evaluateRetrieval(
      [
        { id: 'hit', question: 'q', relevant: ['a'], scope: 'all' },
        { id: 'miss', known_miss: true, question: 'q', relevant: ['z'], scope: 'all' },
      ],
      () => ['a'],
      [1],
    );

    expect(report.query_count).toBe(2);
    expect(report.queries.find((query) => query.id === 'miss')?.reciprocal_rank).toBe(0);
    // The known miss would drag MRR to 0.5 if it were scored.
    expect(report.aggregate.mrr).toBe(1);
  });

  it('flags a metric that falls below baseline', async () => {
    const report = await evaluateRetrieval(
      [{ id: 'q', question: 'q', relevant: ['a'], scope: 'all' }],
      () => ['z', 'a'],
      [1],
    );
    const comparisons = compareToBaseline(report, {
      aggregate: { mrr: 1, ndcg_at_k: {}, precision_at_k: {}, recall_at_k: {} },
      corpus: { knowledge_docs: 0, vault_nodes: 0 },
      recorded_at: '2026-07-28T00:00:00.000Z',
    });

    const mrr = comparisons.find((comparison) => comparison.metric === 'mrr');
    expect(mrr?.regressed).toBe(true);
    expect(mrr?.delta).toBe(-0.5);
  });
});

describe('frozen corpus regression guard', () => {
  it('does not rank below the recorded baseline', async () => {
    const report = await evaluateRetrieval(loadFrozenGoldQueries(), retrieveFromFrozenCorpus);
    const regressions = compareToBaseline(report, baseline).filter((comparison) => comparison.regressed);

    expect(
      regressions.map((regression) => `${regression.metric}: ${regression.baseline} → ${regression.current}`),
    ).toEqual([]);
  });

  it('keeps the frozen corpus in sync with the recorded baseline', () => {
    const documents = loadFrozenDocuments();
    expect({
      knowledge_docs: documents.filter((document) => document.tier === 'knowledge').length,
      vault_nodes: documents.filter((document) => document.tier === 'vault').length,
    }).toEqual(baseline.corpus);
  });

  it('returns nothing relevant for an out-of-domain question', async () => {
    const queries = loadFrozenGoldQueries().filter((query) => query.id === 'off-corpus-question');
    const report = await evaluateRetrieval(queries, retrieveFromFrozenCorpus);

    // Weak incidental matches are acceptable; treating them as answers is not.
    expect(report.queries[0]?.precision_at_k[5]).toBe(0);
  });

  it('ranks the stopword-heavy question on meaning rather than function words', async () => {
    const queries = loadFrozenGoldQueries().filter((query) => query.id === 'stopword-heavy-question');
    const report = await evaluateRetrieval(queries, retrieveFromFrozenCorpus);

    // Before stopword filtering, `what/is/the/of/a/from` matched every document in the corpus.
    expect(report.queries[0]?.ranks['knowledge:wikis/context-reset-guardrails.md']).not.toBeNull();
    expect(report.queries[0]?.retrieved_count).toBeLessThan(loadFrozenDocuments().length);
  });
});

describe('snippet extraction on long documents (Phase 3 evidence)', () => {
  /**
   * Characterization test for a failure ranking metrics cannot see. The transcript ranks first for
   * this question, but the assembled context packet does not contain the sentence that answers it —
   * an early incidental match anchors the snippet in the intro.
   *
   * Phase 3 (passage-level retrieval) should invert both assertions below. When it does, this test
   * will fail loudly, which is the intent: update it rather than delete it.
   */
  it('anchors the snippet on the first match, missing the answer later in the body', () => {
    const document = loadFrozenDocuments().find(
      (entry) => entry.id === 'transcript.long-episode-on-agent-tooling',
    );
    expect(document).toBeDefined();

    const results = rankVaultSearchNodes([toNode(document!)], {
      query: 'How do I combine lexical and semantic search results?',
    });
    const [packet] = buildVaultContextPackets(results);

    expect(packet?.content).toBeDefined();
    expect(packet?.content).toContain('search results from last week');
    // The actual answer — present in the body, absent from the context the model receives.
    expect(document!.body).toContain('reciprocal rank fusion');
    expect(packet?.content).not.toContain('reciprocal rank fusion');
  });
});

function toNode(document: { id: string; title: string; tags: string[]; body: string }): LabNode {
  return {
    body: document.body,
    created_at: '2026-01-01T00:00:00.000Z',
    id: document.id,
    related: [],
    status: 'seed' as NodeStatus,
    tags: document.tags,
    title: document.title,
    type: 'idea' as NodeType,
  } as LabNode;
}
