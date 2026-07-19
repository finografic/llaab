import { z } from 'zod';

import { NodeIdSchema } from './primitives.schema.js';
import { WikiOmittedCanonicalIdeaSchema, WikiOperationSchema, WikiTagSchema, WikiTopicMatchSchema, WikiValidationIssueSchema } from './wiki.schema.js';
import type { WikiValidationIssue } from './wiki.schema.js';

/** One internally discovered topic proposal — never a user-facing review step. */
export const WikiTopicProposalSchema = z
  .object({
    id: NodeIdSchema,
    discovery_batch_id: NodeIdSchema,
    topic_key: NodeIdSchema,
    title: z.string().min(1),
    rationale: z.string().min(1),
    primary_canonical_idea_ids: z.array(NodeIdSchema).min(1),
    supporting_canonical_idea_ids: z.array(NodeIdSchema).default([]),
    domains: z.array(WikiTagSchema).default([]),
    tags: z.array(WikiTagSchema).default([]),
    operation: WikiOperationSchema,
    existing_wiki_id: NodeIdSchema.optional(),
    match_reasons: z.array(WikiTopicMatchSchema).default([]),
    coherence_score: z.number().min(0).max(100),
    warnings: z.array(z.string()).default([]),
    llm_model: z.string().optional(),
    llm_provider: z.string().optional(),
    llm_duration_ms: z.number().int().nonnegative().optional(),
  })
  .superRefine((proposal, ctx) => {
    const primary = new Set(proposal.primary_canonical_idea_ids);
    if (primary.size !== proposal.primary_canonical_idea_ids.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['primary_canonical_idea_ids'],
        message: 'Primary canonical idea ids must be unique within a proposal.',
      });
    }
    const supporting = new Set(proposal.supporting_canonical_idea_ids);
    if (supporting.size !== proposal.supporting_canonical_idea_ids.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['supporting_canonical_idea_ids'],
        message: 'Supporting canonical idea ids must be unique within a proposal.',
      });
    }
    for (const id of proposal.supporting_canonical_idea_ids) {
      if (!primary.has(id)) continue;
      ctx.addIssue({
        code: 'custom',
        path: ['supporting_canonical_idea_ids'],
        message: `Canonical idea ${id} cannot be both primary and supporting in one proposal.`,
      });
    }
    if (!proposal.rationale.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['rationale'],
        message: 'Proposal rationale must be non-empty.',
      });
    }
    if ((proposal.operation === 'update' || proposal.operation === 'no-op') && !proposal.existing_wiki_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['existing_wiki_id'],
        message: `${proposal.operation} proposals require an existing_wiki_id.`,
      });
    }
  });

export const WikiDiscoveryCoverageSchema = z.object({
  primary_assigned_canonical_idea_ids: z.array(NodeIdSchema).default([]),
  supporting_used_canonical_idea_ids: z.array(NodeIdSchema).default([]),
  omitted_canonical_ideas: z.array(WikiOmittedCanonicalIdeaSchema).default([]),
});

/**
 * Zero-to-many internal discovery bundle for one user Create Wiki(s) action.
 * Proposal count is unbounded here — count guidance is a model hint, never a schema quota.
 */
export const WikiDiscoveryResultSchema = z.object({
  discovery_batch_id: NodeIdSchema,
  proposals: z.array(WikiTopicProposalSchema).default([]),
  coverage: WikiDiscoveryCoverageSchema,
  selected_canonical_idea_ids: z.array(NodeIdSchema).min(1),
});

export type WikiTopicProposal = z.infer<typeof WikiTopicProposalSchema>;
export type WikiDiscoveryCoverage = z.infer<typeof WikiDiscoveryCoverageSchema>;
export type WikiDiscoveryResult = z.infer<typeof WikiDiscoveryResultSchema>;

export function normalizeWikiTitleForComparison(title: string): string {
  return title
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export interface ValidateWikiDiscoveryResultOptions {
  selectedCanonicalIdeaIds: string[];
  existingWikiIds?: ReadonlySet<string>;
}

export interface ValidateWikiDiscoveryResultOutput {
  success: boolean;
  issues: WikiValidationIssue[];
  result?: WikiDiscoveryResult;
}

/**
 * Reject invented ids, duplicate topics, empty rationales, unresolved existing-wiki targets,
 * and unaccounted selected ideas. Supporting reuse across proposals is allowed.
 */
export function validateWikiDiscoveryResult(
  raw: unknown,
  options: ValidateWikiDiscoveryResultOptions,
): ValidateWikiDiscoveryResultOutput {
  const issues: WikiValidationIssue[] = [];
  const add = (code: string, message: string) =>
    issues.push(WikiValidationIssueSchema.parse({ code, message }));

  const parsed = WikiDiscoveryResultSchema.safeParse(raw);
  if (!parsed.success) {
    add(
      'invalid-discovery-shape',
      parsed.error.issues[0]?.message ?? 'Discovery result failed schema validation.',
    );
    return { success: false, issues };
  }

  const result = parsed.data;
  const selected = [...new Set(options.selectedCanonicalIdeaIds)];
  if (selected.length === 0) {
    add('empty-selection', 'Discovery requires at least one selected canonical idea.');
    return { success: false, issues };
  }

  const selectedSet = new Set(selected);
  for (const id of result.selected_canonical_idea_ids) {
    if (selectedSet.has(id)) continue;
    add('invented-selected-id', `Discovery selected_canonical_idea_ids includes unknown id: ${id}`);
  }
  for (const id of selected) {
    if (result.selected_canonical_idea_ids.includes(id)) continue;
    add(
      'missing-selected-id',
      `Discovery omitted selected canonical idea from selected_canonical_idea_ids: ${id}`,
    );
  }

  const topicKeys = new Set<string>();
  const normalizedTitles = new Set<string>();
  const primaryOwner = new Map<string, string>();

  for (const proposal of result.proposals) {
    if (proposal.discovery_batch_id !== result.discovery_batch_id) {
      add(
        'batch-id-mismatch',
        `Proposal ${proposal.id} discovery_batch_id does not match the discovery batch.`,
      );
    }
    if (topicKeys.has(proposal.topic_key)) {
      add('duplicate-topic-key', `Duplicate topic_key in discovery batch: ${proposal.topic_key}`);
    }
    topicKeys.add(proposal.topic_key);

    const normalizedTitle = normalizeWikiTitleForComparison(proposal.title);
    if (!normalizedTitle) {
      add('empty-title', `Proposal ${proposal.id} has an empty normalized title.`);
    } else if (normalizedTitles.has(normalizedTitle)) {
      add('duplicate-title', `Duplicate normalized title in discovery batch: ${proposal.title}`);
    }
    normalizedTitles.add(normalizedTitle);

    if (
      proposal.existing_wiki_id &&
      options.existingWikiIds &&
      !options.existingWikiIds.has(proposal.existing_wiki_id)
    ) {
      add(
        'unresolved-existing-wiki',
        `Proposal ${proposal.id} references unknown existing wiki: ${proposal.existing_wiki_id}`,
      );
    }

    for (const id of proposal.primary_canonical_idea_ids) {
      if (!selectedSet.has(id)) {
        add('invented-primary-id', `Proposal ${proposal.id} invents primary canonical idea: ${id}`);
        continue;
      }
      const owner = primaryOwner.get(id);
      if (owner) {
        add(
          'duplicate-primary-assignment',
          `Canonical idea ${id} is primary in multiple proposals (${owner}, ${proposal.id}).`,
        );
        continue;
      }
      primaryOwner.set(id, proposal.id);
    }

    for (const id of proposal.supporting_canonical_idea_ids) {
      if (selectedSet.has(id)) continue;
      add('invented-supporting-id', `Proposal ${proposal.id} invents supporting canonical idea: ${id}`);
    }
  }

  const coveragePrimary = new Set(result.coverage.primary_assigned_canonical_idea_ids);
  const coverageSupporting = new Set(result.coverage.supporting_used_canonical_idea_ids);
  const omitted = new Map(
    result.coverage.omitted_canonical_ideas.map((item) => [item.id, item.reason] as const),
  );

  for (const id of coveragePrimary) {
    if (selectedSet.has(id)) continue;
    add('invented-coverage-primary', `Coverage invents primary-assigned id: ${id}`);
  }
  for (const id of coverageSupporting) {
    if (selectedSet.has(id)) continue;
    add('invented-coverage-supporting', `Coverage invents supporting-used id: ${id}`);
  }
  for (const [id, reason] of omitted) {
    if (!selectedSet.has(id)) {
      add('invented-omitted-id', `Coverage invents omitted id: ${id}`);
    }
    if (!reason.trim()) {
      add('empty-omission-reason', `Omitted canonical idea ${id} lacks a reason.`);
    }
  }

  for (const [id, proposalId] of primaryOwner) {
    if (coveragePrimary.has(id)) continue;
    add(
      'coverage-primary-mismatch',
      `Primary assignment for ${id} in proposal ${proposalId} is missing from coverage.`,
    );
  }
  for (const id of coveragePrimary) {
    if (primaryOwner.has(id)) continue;
    add('coverage-primary-unassigned', `Coverage lists primary-assigned id without a proposal owner: ${id}`);
  }

  for (const id of selected) {
    const isPrimary = coveragePrimary.has(id) || primaryOwner.has(id);
    const isSupporting = coverageSupporting.has(id);
    const isOmitted = omitted.has(id);
    if (isPrimary || isSupporting || isOmitted) continue;
    add('unaccounted-selected-idea', `Selected canonical idea is unaccounted for: ${id}`);
  }

  return issues.length === 0 ? { success: true, issues, result } : { success: false, issues };
}
