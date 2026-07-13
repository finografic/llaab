import { createNode, listKnowledgeWikis, listNodes } from '@llaab/core';

import { runSkill } from '../runner.js';
import { clusterCanonicalIdeasForWikiDiscovery } from './wiki-discovery.utils.js';

export async function discoverWikiCandidates() {
  return runSkill(
    'discover-wiki-candidates',
    async () => {
      const [nodes, transcripts, wikis, existingCandidates] = await Promise.all([
        listNodes({ type: 'canonical-idea' }),
        listNodes({ type: 'transcript' }),
        listKnowledgeWikis(),
        listNodes({ type: 'wiki-candidate' }),
      ]);
      const ideas = nodes.filter((node) => node.type === 'canonical-idea');
      const transcriptById = new Map(
        transcripts
          .filter((node) => node.type === 'transcript')
          .map((transcript) => [transcript.id, transcript]),
      );
      const producedNodeIds: string[] = [];
      for (const { topicKey, ideas: clusteredIdeas } of clusterCanonicalIdeasForWikiDiscovery(ideas)) {
        const representedIdeaIds = new Set(
          wikis
            .filter(
              (wiki) =>
                wiki.topic_key === topicKey || wiki.tags.some((tag) => clusteredIdeas[0]?.tags.includes(tag)),
            )
            .flatMap((wiki) => wiki.source_canonical_idea_ids),
        );
        const ideas = clusteredIdeas.filter((idea) => !representedIdeaIds.has(idea.id));
        const transcriptIds = [...new Set(ideas.map((idea) => idea.transcript_id))];
        if (ideas.length < 3 || transcriptIds.length < 2) continue;
        const candidateId = `${topicKey}-candidate`;
        if (existingCandidates.some((candidate) => candidate.id === candidateId)) continue;
        const existing = wikis.filter(
          (wiki) => wiki.topic_key === topicKey || wiki.tags.some((tag) => ideas[0]?.tags.includes(tag)),
        );
        const sourceIds = [
          ...new Set(
            transcriptIds.flatMap((transcriptId) => {
              const sourceId = transcriptById.get(transcriptId)?.source_id;
              return sourceId ? [sourceId] : [];
            }),
          ),
        ];
        const created = await createNode({
          type: 'wiki-candidate',
          id: candidateId,
          title: topicKey.replace(/-/g, ' '),
          body: 'Deterministically discovered from canonical ideas. Review before compiling a wiki draft.',
          tags: ideas[0]?.tags ?? [],
          extra: {
            topic_key: topicKey,
            source_canonical_idea_ids: ideas.map((idea) => idea.id),
            source_transcript_ids: transcriptIds,
            source_ids: sourceIds,
            heat_score: Math.min(100, ideas.length * 12 + transcriptIds.length * 28 + sourceIds.length * 20),
            novelty_score: existing.length === 0 ? Math.min(100, 60 + sourceIds.length * 20) : 20,
            recommendation: existing.length === 0 ? 'create' : 'needs-review',
            existing_wiki_ids: existing.map((wiki) => wiki.id),
            warnings: existing.length ? ['Existing promoted wiki may already cover this topic.'] : [],
          },
        });
        producedNodeIds.push(created.id);
      }
      return { producedNodeIds, candidateCount: producedNodeIds.length };
    },
    {},
  );
}
