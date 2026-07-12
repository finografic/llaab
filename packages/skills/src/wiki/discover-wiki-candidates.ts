import { createNode, listKnowledgeWikis, listNodes } from '@llaab/core';
import { toNodeId } from '@llaab/schemas';

import { runSkill } from '../runner.js';

export async function discoverWikiCandidates() {
  return runSkill(
    'discover-wiki-candidates',
    async () => {
      const [nodes, wikis, existingCandidates] = await Promise.all([
        listNodes({ type: 'canonical-idea' }),
        listKnowledgeWikis(),
        listNodes({ type: 'wiki-candidate' }),
      ]);
      const ideas = nodes.filter((node) => node.type === 'canonical-idea');
      const groups = new Map<string, typeof ideas>();
      for (const idea of ideas) {
        const topic = toNodeId(idea.tags.find((tag) => tag.startsWith('d:'))?.slice(2) ?? idea.title);
        groups.set(topic, [...(groups.get(topic) ?? []), idea]);
      }
      const producedNodeIds: string[] = [];
      for (const [topicKey, ideas] of groups) {
        const transcriptIds = [...new Set(ideas.map((idea) => idea.transcript_id))];
        if (ideas.length < 3 || transcriptIds.length < 2) continue;
        const candidateId = `${topicKey}-candidate`;
        if (existingCandidates.some((candidate) => candidate.id === candidateId)) continue;
        const existing = wikis.filter(
          (wiki) => wiki.topic_key === topicKey || wiki.tags.some((tag) => ideas[0]?.tags.includes(tag)),
        );
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
            source_ids: [],
            heat_score: Math.min(100, ideas.length * 20 + transcriptIds.length * 20),
            novelty_score: existing.length === 0 ? 100 : 25,
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
