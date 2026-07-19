import type { KnowledgeWikiPage } from '@llaab/schemas';

import { getKnowledgeWikiSectionIds } from './knowledge-wiki-file.utils.js';

export function determineKnowledgeWikiLifecycle(page: KnowledgeWikiPage): 'seed' | 'growing' | 'mature' {
  if (page.verification_status === 'contested') return 'seed';
  // Prefer Phase 1 evidence metrics — never treat citation-ref count as independent sources.
  const independentSourceCount =
    page.evidence_metrics?.independent_source_count ??
    new Set(page.source_refs.map((sourceRef) => sourceRef.node_id ?? sourceRef.id)).size;
  const coverage = page.source_canonical_idea_ids.length;
  const transcripts = page.evidence_metrics?.unique_transcript_count ?? page.source_transcript_ids.length;
  const sections = getKnowledgeWikiSectionIds(page.body).length;

  if (coverage >= 8 && transcripts >= 3 && independentSourceCount >= 3 && sections >= 4) {
    return 'mature';
  }
  if (coverage >= 3 && transcripts >= 2 && independentSourceCount >= 2 && sections >= 2) {
    return 'growing';
  }
  return 'seed';
}
