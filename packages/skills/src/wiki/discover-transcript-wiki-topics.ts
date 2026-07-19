import { createHash } from 'node:crypto';
import { listKnowledgeWikis, readNodeByType } from '@llaab/core';
import { routeLlm } from '@llaab/llm';
import { toNodeId, validateWikiDiscoveryResult, WikiDiscoveryResultSchema } from '@llaab/schemas';
import type { WikiDiscoveryCluster, WikiDiscoverySimilarityOptions } from './wiki-discovery.utils.js';
import type {
  CanonicalIdeaNode,
  KnowledgeWikiPage,
  WikiDiscoveryResult,
  WikiTopicProposal,
  WikiValidationIssue,
} from '@llaab/schemas';

import { resolveWikiTopicProposal } from './wiki-discovery-resolution.utils.js';
import {
  buildDiscoveryContentHash,
  clusterCanonicalIdeasForWikiDiscovery,
  compactWikiSummaries,
  isSourceShapedOrDomainQuotaResult,
} from './wiki-discovery.utils.js';

export interface DiscoverTranscriptWikiTopicsInput {
  transcriptId: string;
  canonicalIdeaIds: string[];
  /** When true, ask wiki-discover to refine split/merge/roles. Deterministic path always runs first. */
  modelReview?: boolean;
  discoveryBatchId?: string;
  similarity?: WikiDiscoverySimilarityOptions;
  /** Injected wiki index for tests; defaults to listKnowledgeWikis(). */
  existingWikis?: KnowledgeWikiPage[];
  /** Injected ideas for tests; defaults to vault reads. */
  canonicalIdeas?: CanonicalIdeaNode[];
}

export interface DiscoverTranscriptWikiTopicsOutput {
  result: WikiDiscoveryResult;
  contentHash: string;
  skipped: Array<{
    clusterId?: string;
    primaryCanonicalIdeaIds: string[];
    reason: string;
    matchReasons: WikiTopicProposal['match_reasons'];
  }>;
  attempts: number;
  usedModelReview: boolean;
}

function discoveryBatchIdFor(input: DiscoverTranscriptWikiTopicsInput, contentHash: string): string {
  if (input.discoveryBatchId) return toNodeId(input.discoveryBatchId);
  return toNodeId(`disc-${input.transcriptId.slice(0, 24)}-${contentHash.slice(0, 10)}`);
}

function proposalIdFor(batchId: string, topicKey: string, index: number): string {
  return toNodeId(`${batchId}-p${index + 1}-${topicKey}`.slice(0, 120));
}

function clustersToDeterministicResult(input: {
  batchId: string;
  selectedIds: string[];
  clusters: WikiDiscoveryCluster[];
  wikis: KnowledgeWikiPage[];
}): {
  result: WikiDiscoveryResult;
  skipped: DiscoverTranscriptWikiTopicsOutput['skipped'];
} {
  const proposals: WikiTopicProposal[] = [];
  const skipped: DiscoverTranscriptWikiTopicsOutput['skipped'] = [];
  const primaryAssigned: string[] = [];
  const supportingUsed = new Set<string>();
  const omitted: Array<{ id: string; reason: string }> = [];

  input.clusters.forEach((cluster, index) => {
    const resolution = resolveWikiTopicProposal(input.wikis, {
      topicKey: cluster.topicKey,
      title: cluster.titleHint,
      primaryCanonicalIdeaIds: cluster.primaryIdeaIds,
      tags: cluster.tags,
    });

    if (resolution.operation === 'skipped') {
      skipped.push({
        clusterId: cluster.id,
        primaryCanonicalIdeaIds: cluster.primaryIdeaIds,
        reason: resolution.reason,
        matchReasons: resolution.matchReasons,
      });
      return;
    }

    const proposal: WikiTopicProposal = {
      id: proposalIdFor(input.batchId, cluster.topicKey, index),
      discovery_batch_id: input.batchId,
      topic_key: cluster.topicKey,
      title: cluster.titleHint,
      rationale: `Primary ideas share fine-tag/claim coherence around ${cluster.topicKey.replace(/-/g, ' ')}. Supporting ideas provide adjacent context only.`,
      primary_canonical_idea_ids: cluster.primaryIdeaIds,
      supporting_canonical_idea_ids: cluster.supportingIdeaIds,
      domains: cluster.domains,
      tags: cluster.tags,
      operation: resolution.operation,
      existing_wiki_id: resolution.existingWikiId,
      match_reasons: resolution.matchReasons,
      coherence_score: cluster.coherenceScore,
      warnings: resolution.operation === 'no-op' ? ['Existing wiki already represents this evidence.'] : [],
    };
    proposals.push(proposal);
    primaryAssigned.push(...cluster.primaryIdeaIds);
    for (const id of cluster.supportingIdeaIds) supportingUsed.add(id);
  });

  const skippedPrimary = new Set(skipped.flatMap((item) => item.primaryCanonicalIdeaIds));
  for (const id of input.selectedIds) {
    if (primaryAssigned.includes(id) || supportingUsed.has(id)) continue;
    if (skippedPrimary.has(id)) {
      const skip = skipped.find((item) => item.primaryCanonicalIdeaIds.includes(id));
      omitted.push({ id, reason: `Skipped: ${skip?.reason ?? 'Ambiguous topic resolution.'}` });
      continue;
    }
    omitted.push({ id, reason: 'Not assigned to a coherent wiki topic.' });
  }

  const raw = {
    discovery_batch_id: input.batchId,
    selected_canonical_idea_ids: input.selectedIds,
    proposals,
    coverage: {
      primary_assigned_canonical_idea_ids: [...new Set(primaryAssigned)],
      supporting_used_canonical_idea_ids: [...supportingUsed],
      omitted_canonical_ideas: omitted,
    },
  };

  const validated = validateWikiDiscoveryResult(raw, {
    selectedCanonicalIdeaIds: input.selectedIds,
    existingWikiIds: new Set(input.wikis.map((wiki) => wiki.id)),
  });
  if (!validated.success || !validated.result) {
    throw new Error(
      `Deterministic discovery failed validation: ${validated.issues.map((issue) => issue.message).join('; ')}`,
    );
  }

  if (
    isSourceShapedOrDomainQuotaResult({
      proposalCount: validated.result.proposals.length,
      selectedIdeaCount: input.selectedIds.length,
      domainsUsed: [...new Set(validated.result.proposals.flatMap((proposal) => proposal.domains))],
      proposals: validated.result.proposals.map((proposal) => ({
        domains: proposal.domains,
        primaryCount: proposal.primary_canonical_idea_ids.length,
        topicKey: proposal.topic_key,
      })),
    })
  ) {
    throw new Error('Deterministic discovery produced a source-shaped or one-domain-per-page result.');
  }

  return { result: validated.result, skipped };
}

function parseModelDiscoveryResult(text: string): unknown {
  const stripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  return JSON.parse(stripped);
}

async function refineWithModel(input: {
  batchId: string;
  selectedIds: string[];
  ideas: CanonicalIdeaNode[];
  clusters: WikiDiscoveryCluster[];
  wikis: KnowledgeWikiPage[];
  baseline: WikiDiscoveryResult;
}): Promise<{ result?: WikiDiscoveryResult; issues: WikiValidationIssue[] }> {
  const prompt = JSON.stringify({
    discovery_batch_id: input.batchId,
    selected_canonical_idea_ids: input.selectedIds,
    deterministic_clusters: input.clusters.map((cluster) => ({
      id: cluster.id,
      topic_key: cluster.topicKey,
      title_hint: cluster.titleHint,
      primary_canonical_idea_ids: cluster.primaryIdeaIds,
      supporting_canonical_idea_ids: cluster.supportingIdeaIds,
      domains: cluster.domains,
      tags: cluster.tags,
      coherence_score: cluster.coherenceScore,
    })),
    canonical_ideas: input.ideas.map((idea) => ({
      id: idea.id,
      title: idea.title,
      body: idea.body,
      key_claims: idea.key_claims,
      tags: idea.tags,
      domains: idea.tags.filter((tag) => tag.startsWith('d:')),
    })),
    existing_wikis: compactWikiSummaries(input.wikis),
    baseline_proposals: input.baseline.proposals,
    instructions: {
      may_split_or_merge: true,
      assign_primary_and_supporting: true,
      omit_with_reasons: true,
      forbid_one_topic_per_domain: true,
      forbid_single_source_digest: true,
      source_independent_titles: true,
    },
  });

  const llm = await routeLlm('wiki-discover', prompt, {
    system: `Refine transcript-scoped wiki topic discovery. Return ONLY JSON for WikiDiscoveryResult:
{"discovery_batch_id":"...","selected_canonical_idea_ids":[],"proposals":[{"id":"...","discovery_batch_id":"...","topic_key":"...","title":"...","rationale":"...","primary_canonical_idea_ids":[],"supporting_canonical_idea_ids":[],"domains":[],"tags":[],"operation":"create|update|no-op","existing_wiki_id":"...","match_reasons":[],"coherence_score":0,"warnings":[]}],"coverage":{"primary_assigned_canonical_idea_ids":[],"supporting_used_canonical_idea_ids":[],"omitted_canonical_ideas":[{"id":"...","reason":"..."}]}}.
Use only supplied ids. Prefer source-independent titles. Do not invent topic suffixes. Do not collapse broad selections into one digest.`,
    bypassCache: true,
  });

  let parsed: unknown;
  try {
    parsed = parseModelDiscoveryResult(llm.text);
  } catch {
    return { issues: [{ code: 'malformed-json', message: 'wiki-discover returned malformed JSON.' }] };
  }

  // Force batch id and re-resolve operations against the live wiki index.
  const asRecord = parsed as { proposals?: unknown[]; discovery_batch_id?: string };
  const proposals = Array.isArray(asRecord.proposals) ? asRecord.proposals : [];
  const normalizedProposals = proposals.map((rawProposal, index) => {
    const proposal = rawProposal as Record<string, unknown>;
    const primary = Array.isArray(proposal.primary_canonical_idea_ids)
      ? proposal.primary_canonical_idea_ids.filter((id): id is string => typeof id === 'string')
      : [];
    const supporting = Array.isArray(proposal.supporting_canonical_idea_ids)
      ? proposal.supporting_canonical_idea_ids.filter((id): id is string => typeof id === 'string')
      : [];
    const tags = Array.isArray(proposal.tags)
      ? proposal.tags.filter((tag): tag is string => typeof tag === 'string')
      : [];
    const title = typeof proposal.title === 'string' ? proposal.title : `Topic ${index + 1}`;
    const topicKey = typeof proposal.topic_key === 'string' ? toNodeId(proposal.topic_key) : toNodeId(title);
    const resolution = resolveWikiTopicProposal(input.wikis, {
      topicKey,
      title,
      primaryCanonicalIdeaIds: primary,
      tags,
    });
    return {
      id:
        typeof proposal.id === 'string'
          ? toNodeId(proposal.id)
          : proposalIdFor(input.batchId, topicKey, index),
      discovery_batch_id: input.batchId,
      topic_key: topicKey,
      title,
      rationale: typeof proposal.rationale === 'string' ? proposal.rationale : '',
      primary_canonical_idea_ids: primary,
      supporting_canonical_idea_ids: supporting,
      domains: Array.isArray(proposal.domains)
        ? proposal.domains.filter((domain): domain is string => typeof domain === 'string')
        : tags.filter((tag) => tag.startsWith('d:')),
      tags,
      operation: resolution.operation === 'skipped' ? 'needs-review' : resolution.operation,
      existing_wiki_id: resolution.existingWikiId,
      match_reasons: resolution.matchReasons,
      coherence_score: typeof proposal.coherence_score === 'number' ? proposal.coherence_score : 0,
      warnings: [
        ...(Array.isArray(proposal.warnings)
          ? proposal.warnings.filter((warning): warning is string => typeof warning === 'string')
          : []),
        ...(resolution.operation === 'skipped' ? [resolution.reason] : []),
      ],
    };
  });

  // Drop skipped/needs-review proposals into omitted coverage instead of failing the bundle.
  const actionable = normalizedProposals.filter((proposal) => proposal.operation !== 'needs-review');
  const skippedPrimaryIds = normalizedProposals
    .filter((proposal) => proposal.operation === 'needs-review')
    .flatMap((proposal) => proposal.primary_canonical_idea_ids);

  const coverage = (asRecord as { coverage?: Record<string, unknown> }).coverage ?? {};
  const omitted = Array.isArray(coverage.omitted_canonical_ideas)
    ? [...coverage.omitted_canonical_ideas]
    : [];
  for (const id of skippedPrimaryIds) {
    omitted.push({ id, reason: 'Ambiguous existing-wiki overlap; branch skipped.' });
  }

  const candidate = {
    discovery_batch_id: input.batchId,
    selected_canonical_idea_ids: input.selectedIds,
    proposals: actionable,
    coverage: {
      primary_assigned_canonical_idea_ids: Array.isArray(coverage.primary_assigned_canonical_idea_ids)
        ? coverage.primary_assigned_canonical_idea_ids
        : actionable.flatMap((proposal) => proposal.primary_canonical_idea_ids),
      supporting_used_canonical_idea_ids: Array.isArray(coverage.supporting_used_canonical_idea_ids)
        ? coverage.supporting_used_canonical_idea_ids
        : [],
      omitted_canonical_ideas: omitted,
    },
  };

  const shape = WikiDiscoveryResultSchema.safeParse(candidate);
  if (!shape.success) {
    return {
      issues: [
        { code: 'invalid-shape', message: shape.error.issues[0]?.message ?? 'Invalid discovery shape.' },
      ],
    };
  }

  const validated = validateWikiDiscoveryResult(shape.data, {
    selectedCanonicalIdeaIds: input.selectedIds,
    existingWikiIds: new Set(input.wikis.map((wiki) => wiki.id)),
  });
  if (!validated.success || !validated.result) {
    return { issues: validated.issues };
  }

  if (
    isSourceShapedOrDomainQuotaResult({
      proposalCount: validated.result.proposals.length,
      selectedIdeaCount: input.selectedIds.length,
      domainsUsed: [...new Set(validated.result.proposals.flatMap((proposal) => proposal.domains))],
      proposals: validated.result.proposals.map((proposal) => ({
        domains: proposal.domains,
        primaryCount: proposal.primary_canonical_idea_ids.length,
        topicKey: proposal.topic_key,
      })),
    })
  ) {
    return {
      issues: [
        {
          code: 'source-shaped',
          message: 'Model discovery collapsed into a source digest or one-topic-per-domain set.',
        },
      ],
    };
  }

  return { result: validated.result, issues: [] };
}

export async function discoverTranscriptWikiTopics(
  input: DiscoverTranscriptWikiTopicsInput,
): Promise<DiscoverTranscriptWikiTopicsOutput> {
  if (input.canonicalIdeaIds.length === 0) {
    throw new Error('Discovery requires at least one selected canonical idea.');
  }
  if (new Set(input.canonicalIdeaIds).size !== input.canonicalIdeaIds.length) {
    throw new Error('Discovery selection contains duplicate canonical idea ids.');
  }

  const ideas =
    input.canonicalIdeas ??
    (await Promise.all(input.canonicalIdeaIds.map((id) => readNodeByType('canonical-idea', id))));
  for (const idea of ideas) {
    if (!input.canonicalIdeaIds.includes(idea.id)) {
      throw new Error(`Discovery idea set mismatch for ${idea.id}.`);
    }
  }

  const wikis = input.existingWikis ?? (await listKnowledgeWikis());
  const contentHash = buildDiscoveryContentHash({
    canonicalIdeaIds: input.canonicalIdeaIds,
    ideas,
    wikiSummaries: wikis.map((wiki) => ({
      id: wiki.id,
      topic_key: wiki.topic_key,
      revision: wiki.revision,
    })),
  });
  const batchId = discoveryBatchIdFor(input, contentHash);
  const clusters = clusterCanonicalIdeasForWikiDiscovery(ideas, input.similarity);
  const deterministic = clustersToDeterministicResult({
    batchId,
    selectedIds: input.canonicalIdeaIds,
    clusters,
    wikis,
  });

  let attempts = 1;
  let usedModelReview = false;
  let result = deterministic.result;
  let skipped = deterministic.skipped;

  if (input.modelReview) {
    usedModelReview = true;
    let refined = await refineWithModel({
      batchId,
      selectedIds: input.canonicalIdeaIds,
      ideas,
      clusters,
      wikis,
      baseline: deterministic.result,
    });
    attempts += 1;
    if (!refined.result) {
      refined = await refineWithModel({
        batchId,
        selectedIds: input.canonicalIdeaIds,
        ideas,
        clusters,
        wikis,
        baseline: deterministic.result,
      });
      attempts += 1;
    }
    if (refined.result) {
      result = refined.result;
      skipped = [
        ...deterministic.skipped,
        ...result.coverage.omitted_canonical_ideas
          .filter((item) => item.reason.toLowerCase().includes('ambiguous'))
          .map((item) => ({
            primaryCanonicalIdeaIds: [item.id],
            reason: item.reason,
            matchReasons: [],
          })),
      ];
    }
  }

  return {
    result,
    contentHash,
    skipped,
    attempts,
    usedModelReview,
  };
}

/** Stable hash helper exported for tests/operators. */
export function hashDiscoverySelection(canonicalIdeaIds: string[]): string {
  return createHash('sha256')
    .update([...canonicalIdeaIds].sort().join('|'))
    .digest('hex');
}
