import type { KnowledgeWikiPage } from '@llaab/schemas';

import { getKnowledgeWikiSectionIds } from './knowledge-wiki-file.utils.js';

export function determineKnowledgeWikiLifecycle(page: KnowledgeWikiPage): 'seed' | 'growing' | 'mature' {
  if (page.verification_status === 'contested') return 'seed';
  const independentSources = new Set(page.source_refs.map((sourceRef) => sourceRef.node_id ?? sourceRef.id));
  const coverage = page.source_canonical_idea_ids.length;
  const transcripts = page.source_transcript_ids.length;
  const sections = getKnowledgeWikiSectionIds(page.body).length;

  if (coverage >= 8 && transcripts >= 3 && independentSources.size >= 3 && sections >= 4) {
    return 'mature';
  }
  if (coverage >= 3 && transcripts >= 2 && independentSources.size >= 2 && sections >= 2) {
    return 'growing';
  }
  return 'seed';
}
