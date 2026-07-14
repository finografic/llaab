import { createNode, listKnowledgeWikis, listNodes } from '@llaab/core';
import { routeLlm } from '@llaab/llm';
import { NodeIdSchema, WikiOperationSchema } from '@llaab/schemas';

import { runSkill } from '../runner.js';
import { clusterCanonicalIdeasForWikiDiscovery } from './wiki-discovery.utils.js';

interface WikiDiscoveryReview {
  title: string;
  topic_key: string;
  recommendation: ReturnType<typeof WikiOperationSchema.parse>;
  canonical_idea_ids: string[];
  existing_wiki_ids: string[];
  warnings: string[];
}

function parseDiscoveryReview(text: string): WikiDiscoveryReview {
  const parsed: unknown = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Wiki discovery review must be a JSON object.');
  }
  const value = parsed as Record<string, unknown>;
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const canonicalIdeaIds = Array.isArray(value.canonical_idea_ids) ? value.canonical_idea_ids : [];
  const existingWikiIds = Array.isArray(value.existing_wiki_ids) ? value.existing_wiki_ids : [];
  const warnings = Array.isArray(value.warnings) ? value.warnings : [];
  if (
    !title ||
    title.length > 200 ||
    canonicalIdeaIds.length === 0 ||
    canonicalIdeaIds.some((id) => typeof id !== 'string')
  ) {
    throw new Error('Wiki discovery review has an invalid title or canonical idea ids.');
  }
  if (
    existingWikiIds.some((id) => typeof id !== 'string') ||
    warnings.some((warning) => typeof warning !== 'string')
  ) {
    throw new Error('Wiki discovery review has invalid wiki ids or warnings.');
  }
  return {
    title,
    topic_key: NodeIdSchema.parse(value.topic_key),
    recommendation: WikiOperationSchema.parse(value.recommendation),
    canonical_idea_ids: canonicalIdeaIds.map((id) => NodeIdSchema.parse(id)),
    existing_wiki_ids: existingWikiIds.map((id) => NodeIdSchema.parse(id)),
    warnings: warnings.slice(0, 8),
  };
}

interface DiscoverWikiCandidatesOptions {
  minCanonicalIdeas?: number;
  minTranscripts?: number;
  modelReview?: boolean;
}

export async function discoverWikiCandidates({
  minCanonicalIdeas = 3,
  minTranscripts = 2,
  modelReview = false,
}: DiscoverWikiCandidatesOptions = {}) {
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
        if (ideas.length < minCanonicalIdeas || transcriptIds.length < minTranscripts) continue;
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
        const deterministicRecommendation = existing.length === 0 ? 'create' : 'needs-review';
        const review = modelReview
          ? await routeLlm(
              'wiki-discover',
              JSON.stringify({
                topic_key: topicKey,
                canonical_ideas: ideas.map((idea) => ({
                  id: idea.id,
                  title: idea.title,
                  key_claims: idea.key_claims,
                })),
                existing_wikis: existing.map((wiki) => ({
                  id: wiki.id,
                  topic_key: wiki.topic_key,
                  title: wiki.title,
                })),
              }),
              {
                system:
                  'Judge this deterministic wiki cluster only. Return JSON with title, topic_key, recommendation, canonical_idea_ids, existing_wiki_ids, and warnings. Do not add ids.',
                bypassCache: true,
              },
            )
          : undefined;
        const reviewResult = review ? parseDiscoveryReview(review.text) : undefined;
        if (reviewResult) {
          const allowedIdeaIds = new Set(ideas.map((idea) => idea.id));
          const allowedWikiIds = new Set(existing.map((wiki) => wiki.id));
          if (
            reviewResult.canonical_idea_ids.some((id) => !allowedIdeaIds.has(id)) ||
            reviewResult.existing_wiki_ids.some((id) => !allowedWikiIds.has(id))
          ) {
            throw new Error('Wiki discovery review introduced ids outside the deterministic cluster.');
          }
        }
        const alternateTopicWarning =
          reviewResult && reviewResult.topic_key !== topicKey
            ? `Model suggested alternate topic key "${reviewResult.topic_key}"; keep the deterministic cluster key until a reviewer explicitly splits or merges it.`
            : undefined;
        const created = await createNode({
          type: 'wiki-candidate',
          id: candidateId,
          title: reviewResult?.title ?? topicKey.replace(/-/g, ' '),
          body: 'Deterministically discovered from canonical ideas. Review before compiling a wiki draft.',
          tags: ideas[0]?.tags ?? [],
          extra: {
            topic_key: topicKey,
            source_canonical_idea_ids: reviewResult?.canonical_idea_ids ?? ideas.map((idea) => idea.id),
            source_transcript_ids: transcriptIds,
            source_ids: sourceIds,
            heat_score: Math.min(100, ideas.length * 12 + transcriptIds.length * 28 + sourceIds.length * 20),
            novelty_score: existing.length === 0 ? Math.min(100, 60 + sourceIds.length * 20) : 20,
            recommendation: reviewResult?.recommendation ?? deterministicRecommendation,
            existing_wiki_ids: reviewResult?.existing_wiki_ids ?? existing.map((wiki) => wiki.id),
            warnings: [
              ...(existing.length ? ['Existing promoted wiki may already cover this topic.'] : []),
              ...(reviewResult?.warnings ?? []),
              ...(alternateTopicWarning ? [alternateTopicWarning] : []),
            ],
            ...(review
              ? { llm_model: review.model, llm_provider: review.provider, llm_duration_ms: review.durationMs }
              : {}),
          },
        });
        producedNodeIds.push(created.id);
      }
      return { producedNodeIds, candidateCount: producedNodeIds.length };
    },
    {},
  );
}
