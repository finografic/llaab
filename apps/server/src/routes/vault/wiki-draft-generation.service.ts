import { readNodeByType } from '@llaab/core';
import {
  appendProducedNodeIds,
  appendRunEvent,
  compileWikiDraft,
  discoverTranscriptWikiTopics,
  runSkill,
} from '@llaab/skills';
import type { CreateWikiDraftBody } from './vault-wiki-drafts.schema.js';
import type { CanonicalIdeaNode } from '@llaab/schemas';

interface WikiDraftIdeaGroup {
  canonicalIdeaIds: string[];
  domains: Set<string>;
  tokens: Set<string>;
}

const MIN_SHARED_TOPIC_TOKENS = 2;
const STOP_WORDS = new Set([
  'about',
  'after',
  'agent',
  'agents',
  'against',
  'also',
  'assisted',
  'because',
  'before',
  'being',
  'code',
  'coding',
  'development',
  'developer',
  'developers',
  'from',
  'generated',
  'into',
  'model',
  'models',
  'more',
  'need',
  'needs',
  'over',
  'should',
  'than',
  'that',
  'their',
  'them',
  'this',
  'through',
  'with',
]);

function normalizeTopicToken(token: string): string {
  return token
    .replace(/(?:ization|isation)$/, 'ize')
    .replace(/(?:ing|ed|es|s)$/, '')
    .trim();
}

function canonicalIdeaDomains(idea: CanonicalIdeaNode): Set<string> {
  return new Set(idea.tags.filter((tag) => tag.startsWith('d:')));
}

function canonicalIdeaTokens(idea: CanonicalIdeaNode): Set<string> {
  const text = [
    idea.title,
    idea.body,
    ...idea.key_claims,
    ...idea.tags.map((tag) => tag.replace(/^d:/, '')),
  ].join(' ');
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map(normalizeTopicToken)
      .filter((token) => token.length >= 4 && !STOP_WORDS.has(token)),
  );
}

function sharedCount(first: Set<string>, second: Set<string>): number {
  return [...first].filter((value) => second.has(value)).length;
}

function hasOverlap(first: Set<string>, second: Set<string>): boolean {
  return [...first].some((value) => second.has(value));
}

function shouldJoinGroup(group: WikiDraftIdeaGroup, domains: Set<string>, tokens: Set<string>): boolean {
  const sharedTokens = sharedCount(group.tokens, tokens);
  if (sharedTokens >= MIN_SHARED_TOPIC_TOKENS) return true;
  return sharedTokens >= 1 && hasOverlap(group.domains, domains);
}

/**
 * Legacy greedy grouping heuristic retained for Phase 0 characterization baselines.
 * Transcript wiki creation uses discoverTranscriptWikiTopics instead.
 */
export function groupCanonicalIdeasByHeuristic(
  ideas: CanonicalIdeaNode[],
  options: { forceSingleDraft: boolean } = { forceSingleDraft: false },
): string[][] {
  if (options.forceSingleDraft || ideas.length <= 1) {
    return [ideas.map((idea) => idea.id)];
  }

  const groups: WikiDraftIdeaGroup[] = [];
  for (const idea of ideas) {
    const domains = canonicalIdeaDomains(idea);
    const tokens = canonicalIdeaTokens(idea);
    const group = groups.find((candidate) => shouldJoinGroup(candidate, domains, tokens));
    if (group) {
      group.canonicalIdeaIds.push(idea.id);
      for (const domain of domains) group.domains.add(domain);
      for (const token of tokens) group.tokens.add(token);
    } else {
      groups.push({ canonicalIdeaIds: [idea.id], domains, tokens });
    }
  }

  return groups.map((group) => group.canonicalIdeaIds);
}

/** @deprecated Recovery/characterization only — normal path uses Phase 2 discovery. */
export async function groupCanonicalIdeasForWikiDrafts(input: {
  canonicalIdeaIds: string[];
  forceSingleDraft: boolean;
}): Promise<string[][]> {
  if (input.forceSingleDraft || input.canonicalIdeaIds.length <= 1) return [input.canonicalIdeaIds];

  const ideas = await Promise.all(input.canonicalIdeaIds.map((id) => readNodeByType('canonical-idea', id)));
  return groupCanonicalIdeasByHeuristic(ideas, { forceSingleDraft: input.forceSingleDraft });
}

export type TranscriptWikiCompileBranch =
  | {
      kind: 'compiled';
      proposalId?: string;
      draftId: string;
      runId: string;
      coherenceFailed: boolean;
      warnings: string[];
    }
  | {
      kind: 'no-op';
      proposalId?: string;
      existingWikiId: string;
      reason: string;
    }
  | {
      kind: 'skipped';
      proposalId?: string;
      reason: string;
      primaryCanonicalIdeaIds: string[];
    }
  | {
      kind: 'failed';
      proposalId?: string;
      reason: string;
      runId?: string;
    };

export type CompiledWikiDraftResult = Awaited<ReturnType<typeof compileWikiDraft>>;

export interface CompileWikiDraftsForTranscriptResult {
  parentRunId: string;
  discoveryBatchId?: string;
  branches: TranscriptWikiCompileBranch[];
  /** Successful compile skill results (includes coherence-failed audit drafts). */
  compiled: CompiledWikiDraftResult[];
}

async function compileOneProposal(input: {
  transcriptId: string;
  parentRunId: string;
  discoveryBatchId?: string;
  proposal?: Parameters<typeof compileWikiDraft>[0]['proposal'];
  canonicalIdeaIds: string[];
  primaryCanonicalIdeaIds?: string[];
  supportingCanonicalIdeaIds?: string[];
  suggestedTitle?: string;
  suggestedTopicKey?: string;
  targetWikiId?: string;
  forceUpdate?: boolean;
}): Promise<CompiledWikiDraftResult> {
  return compileWikiDraft({
    transcriptId: input.transcriptId,
    canonicalIdeaIds: input.canonicalIdeaIds,
    primaryCanonicalIdeaIds: input.primaryCanonicalIdeaIds,
    supportingCanonicalIdeaIds: input.supportingCanonicalIdeaIds,
    proposal: input.proposal,
    discoveryBatchId: input.discoveryBatchId,
    parentRunId: input.parentRunId,
    suggestedTitle: input.suggestedTitle,
    suggestedTopicKey: input.suggestedTopicKey,
    targetWikiId: input.targetWikiId,
    entryPath: 'manual',
    forceUpdate: input.forceUpdate,
  });
}

export async function compileWikiDraftsForTranscript(input: {
  transcriptId: string;
  body: CreateWikiDraftBody;
}): Promise<CompileWikiDraftsForTranscriptResult> {
  const { record, result } = await runSkill(
    'compile-transcript-wikis',
    async (_, parentRunId) => {
      const forceSingleDraft =
        input.body.target_wiki_id !== undefined ||
        input.body.suggested_topic_key !== undefined ||
        input.body.suggested_title !== undefined;

      const branches: TranscriptWikiCompileBranch[] = [];
      const compiled: CompiledWikiDraftResult[] = [];

      // Explicit target/title/topic-key requests keep a single compile path for recovery tooling.
      if (forceSingleDraft) {
        await appendRunEvent(parentRunId, {
          level: 'info',
          message: 'Compiling recovery single-topic wiki draft.',
        });
        const one = await compileOneProposal({
          transcriptId: input.transcriptId,
          parentRunId,
          canonicalIdeaIds: input.body.canonical_idea_ids,
          suggestedTitle: input.body.suggested_title,
          suggestedTopicKey: input.body.suggested_topic_key,
          targetWikiId: input.body.target_wiki_id,
        });
        if (one.record.status === 'failed' || !one.result?.draftId) {
          branches.push({
            kind: 'failed',
            reason: one.record.error ?? 'Wiki compilation failed.',
            runId: one.record.runNodeId,
          });
        } else {
          compiled.push(one);
          branches.push({
            kind: 'compiled',
            draftId: one.result.draftId,
            runId: one.record.runNodeId,
            coherenceFailed: one.result.coherenceFailed,
            warnings: one.result.warnings,
          });
          await appendProducedNodeIds(parentRunId, [one.result.draftId]);
        }
        return { discoveryBatchId: undefined as string | undefined, branches, compiled };
      }

      await appendRunEvent(parentRunId, {
        level: 'info',
        message: 'Discovering coherent wiki topics for selected canonical ideas.',
      });
      const discovery = await discoverTranscriptWikiTopics({
        transcriptId: input.transcriptId,
        canonicalIdeaIds: input.body.canonical_idea_ids,
        modelReview: false,
      });
      await appendRunEvent(parentRunId, {
        level: 'info',
        message: `Discovery produced ${discovery.result.proposals.length} proposal(s); skipped ${discovery.skipped.length}.`,
      });

      for (const skipped of discovery.skipped) {
        branches.push({
          kind: 'skipped',
          reason: skipped.reason,
          primaryCanonicalIdeaIds: skipped.primaryCanonicalIdeaIds,
        });
      }

      for (const proposal of discovery.result.proposals) {
        if (proposal.operation === 'needs-review') {
          branches.push({
            kind: 'skipped',
            proposalId: proposal.id,
            reason: proposal.warnings[0] ?? 'Proposal requires review and was skipped.',
            primaryCanonicalIdeaIds: proposal.primary_canonical_idea_ids,
          });
          continue;
        }

        if (proposal.operation === 'no-op') {
          if (!proposal.existing_wiki_id) {
            branches.push({
              kind: 'failed',
              proposalId: proposal.id,
              reason: 'no-op proposal missing existing_wiki_id.',
            });
            continue;
          }
          branches.push({
            kind: 'no-op',
            proposalId: proposal.id,
            existingWikiId: proposal.existing_wiki_id,
            reason: proposal.warnings[0] ?? 'Existing wiki already represents this evidence.',
          });
          await appendRunEvent(parentRunId, {
            level: 'info',
            message: `Skipped rewrite for no-op topic ${proposal.topic_key} → ${proposal.existing_wiki_id}.`,
          });
          continue;
        }

        const canonicalIdeaIds = [
          ...new Set([...proposal.primary_canonical_idea_ids, ...proposal.supporting_canonical_idea_ids]),
        ];

        try {
          await appendRunEvent(parentRunId, {
            level: 'info',
            message: `Compiling proposal ${proposal.topic_key} (${proposal.operation}).`,
          });
          const one = await compileOneProposal({
            transcriptId: input.transcriptId,
            parentRunId,
            discoveryBatchId: discovery.result.discovery_batch_id,
            proposal: {
              id: proposal.id,
              discovery_batch_id: proposal.discovery_batch_id,
              topic_key: proposal.topic_key,
              title: proposal.title,
              rationale: proposal.rationale,
              primary_canonical_idea_ids: proposal.primary_canonical_idea_ids,
              supporting_canonical_idea_ids: proposal.supporting_canonical_idea_ids,
              domains: proposal.domains,
              tags: proposal.tags,
              operation: proposal.operation,
              existing_wiki_id: proposal.existing_wiki_id,
              coherence_score: proposal.coherence_score,
              warnings: proposal.warnings,
            },
            canonicalIdeaIds,
            primaryCanonicalIdeaIds: proposal.primary_canonical_idea_ids,
            supportingCanonicalIdeaIds: proposal.supporting_canonical_idea_ids,
            suggestedTitle: proposal.title,
            suggestedTopicKey: proposal.topic_key,
            targetWikiId: proposal.existing_wiki_id,
            forceUpdate: proposal.operation === 'update',
          });

          if (one.record.status === 'failed' || !one.result?.draftId) {
            branches.push({
              kind: 'failed',
              proposalId: proposal.id,
              reason: one.record.error ?? 'Wiki compilation failed.',
              runId: one.record.runNodeId,
            });
            await appendRunEvent(parentRunId, {
              level: 'warning',
              message: `Proposal ${proposal.topic_key} failed: ${one.record.error ?? 'unknown error'}`,
            });
            continue;
          }

          compiled.push(one);
          branches.push({
            kind: 'compiled',
            proposalId: proposal.id,
            draftId: one.result.draftId,
            runId: one.record.runNodeId,
            coherenceFailed: one.result.coherenceFailed,
            warnings: one.result.warnings,
          });
          await appendProducedNodeIds(parentRunId, [one.result.draftId]);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          branches.push({
            kind: 'failed',
            proposalId: proposal.id,
            reason,
          });
          await appendRunEvent(parentRunId, {
            level: 'warning',
            message: `Proposal ${proposal.topic_key} failed: ${reason}`,
          });
        }
      }

      const hasSuccess = compiled.length > 0 || branches.some((branch) => branch.kind === 'no-op');
      if (!hasSuccess) {
        throw new Error(
          branches.find((branch) => branch.kind === 'failed' || branch.kind === 'skipped')?.reason ??
            'Topic discovery produced no compileable wiki proposals for the selected ideas.',
        );
      }

      return {
        discoveryBatchId: discovery.result.discovery_batch_id,
        branches,
        compiled,
      };
    },
    {
      transcriptId: input.transcriptId,
      canonicalIdeaIds: input.body.canonical_idea_ids,
      suggestedTitle: input.body.suggested_title,
      suggestedTopicKey: input.body.suggested_topic_key,
      targetWikiId: input.body.target_wiki_id,
    },
  );

  if (record.status === 'failed' || !result) {
    throw new Error(record.error ?? 'Transcript wiki compilation failed.');
  }

  return {
    parentRunId: record.runNodeId,
    discoveryBatchId: result.discoveryBatchId,
    branches: result.branches,
    compiled: result.compiled,
  };
}
