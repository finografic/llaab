import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import {
  cleanRecentVaultActivity,
  createNode,
  deleteNode,
  getNodeFilePath,
  listNodes,
  readNode,
  updateNode,
  VAULT_ROOT,
} from '@llaab/core';
import { enrichSourceMetadata, extractKnowledgeFromTranscript } from '@llaab/ingestion';
import { routeLlm } from '@llaab/llm';
import { formatInstantForFilenameId, formatIsoUtcSeconds } from '@llaab/schemas';
import { appendProducedNodeIds, appendRunEvent, setRunLlmTrace } from '@llaab/skills';
import { deleteCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import type { AppCtx, AppCtxJson, AppCtxQuery } from '../../types/app.types.js';
import type {
  CleanRecentBody,
  CreateNodeBody,
  DeleteRunsPreviewBody,
  ListNodesQuery,
  PromoteCanonicalIdeaBody,
  UpdateSourceProfilesBody,
  VaultLoginBody,
} from './vault.schema.js';
import type {
  CanonicalIdeaNode,
  IdeaNode,
  LabNode,
  RunNode,
  SourceNode,
  TranscriptNode,
} from '@llaab/schemas';

import {
  getVaultPassword,
  isVaultAuthEnabled,
  isVaultSessionValid,
  VAULT_COOKIE_MAX_AGE,
  VAULT_COOKIE_NAME,
} from '../../lib/vault-auth.js';
import { readVaultRootTree } from '../../lib/vault-tree.js';
import { deleteRunQuerySchema } from './vault.schema.js';

const ConsolidatedIdeaDraftSchema = z
  .object({
    title: z.string().min(1),
    body: z.string().optional().default(''),
    tags: z.array(z.string()).default([]),
    domains: z.array(z.string()).default([]),
    sourceCandidateIdeaIds: z.array(z.string().min(1)).default([]),
    source_candidate_idea_ids: z.array(z.string().min(1)).default([]),
    confidence: z.enum(['low', 'medium', 'high']),
    keyClaims: z.array(z.string().min(1)).default([]),
    key_claims: z.array(z.string().min(1)).default([]),
    coverageNotes: z.string().optional().default(''),
    coverage_notes: z.string().optional().default(''),
  })
  .transform((idea) => ({
    title: idea.title,
    body: idea.body,
    tags: idea.tags,
    domains: idea.domains,
    sourceCandidateIdeaIds:
      idea.sourceCandidateIdeaIds.length > 0 ? idea.sourceCandidateIdeaIds : idea.source_candidate_idea_ids,
    confidence: idea.confidence,
    keyClaims: idea.keyClaims.length > 0 ? idea.keyClaims : idea.key_claims,
    coverageNotes: idea.coverageNotes || idea.coverage_notes,
  }))
  .pipe(
    z.object({
      title: z.string().min(1),
      body: z.string(),
      tags: z.array(z.string()),
      domains: z.array(z.string()),
      sourceCandidateIdeaIds: z.array(z.string().min(1)).min(1),
      confidence: z.enum(['low', 'medium', 'high']),
      keyClaims: z.array(z.string()),
      coverageNotes: z.string(),
    }),
  );

const ConsolidatedIdeasResponseSchema = z.object({
  ideas: z.array(ConsolidatedIdeaDraftSchema).min(1),
});

const ConsolidationCoverageStatusSchema = z.enum(['covered', 'omitted', 'missed']);

const ConsolidationCoverageItemSchema = z
  .object({
    candidateId: z.string().min(1).optional(),
    candidate_id: z.string().min(1).optional(),
    canonicalIdeaIndexes: z.array(z.number().int().nonnegative()).optional().default([]),
    canonical_idea_indexes: z.array(z.number().int().nonnegative()).optional().default([]),
    status: ConsolidationCoverageStatusSchema,
    reason: z.string().optional().default(''),
  })
  .transform((item) => ({
    candidateId: item.candidateId ?? item.candidate_id ?? '',
    canonicalIdeaIndexes:
      item.canonicalIdeaIndexes.length > 0 ? item.canonicalIdeaIndexes : item.canonical_idea_indexes,
    status: item.status,
    reason: item.reason,
  }))
  .pipe(
    z.object({
      candidateId: z.string().min(1),
      canonicalIdeaIndexes: z.array(z.number().int().nonnegative()),
      status: ConsolidationCoverageStatusSchema,
      reason: z.string(),
    }),
  );

const ConsolidationAuditResponseSchema = z.object({
  coverage: z.array(ConsolidationCoverageItemSchema).default([]),
  additions: z.array(ConsolidatedIdeaDraftSchema).default([]),
});

type ConsolidatedIdeaDraft = z.infer<typeof ConsolidatedIdeaDraftSchema>;
type ConsolidationCoverageItem = z.infer<typeof ConsolidationCoverageItemSchema>;

interface CandidateIdeaPayload {
  id: string;
  runId: string;
  title: string;
  body?: string;
  domains: string[];
  tags: string[];
}

function parseJsonFromLlmText(text: string): unknown {
  const stripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in LLM response');
  const candidate = stripped.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to parse JSON from LLM response (${message}). Response was likely truncated ` +
        `(${candidate.length} chars); tail: ${candidate.slice(-200)}`,
    );
  }
}

function splitIdeaTags(tags: string[]): { domains: string[]; topics: string[] } {
  return {
    domains: tags.filter((tag) => tag.startsWith('d:')),
    topics: tags.filter((tag) => !tag.startsWith('d:')),
  };
}

function normalizeTag(value: string): string {
  return value
    .toLocaleLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9:-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function dedupeTags(values: string[]): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const value of values) {
    const tag = normalizeTag(value);
    if (tag.length === 0 || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}

function buildConsolidationPrompt(transcript: TranscriptNode, candidates: CandidateIdeaPayload[]): string {
  return JSON.stringify(
    {
      task: 'consolidate-canonical-ideas',
      transcript: {
        id: transcript.id,
        title: transcript.title,
        summary: transcript.summary,
        tags: transcript.tags,
      },
      candidates,
      instructions: [
        'Merge duplicate or substantially overlapping candidate ideas.',
        'Preserve related but distinct ideas as separate canonical ideas.',
        'Do not create ideas unsupported by the candidates.',
        'Every canonical idea must include sourceCandidateIdeaIds referencing one or more candidate ids.',
        'Add keyClaims for the core claims that make each canonical idea distinct.',
        'Return concise, improved wording.',
      ],
    },
    null,
    2,
  );
}

const CONSOLIDATION_SYSTEM_PROMPT = `You consolidate extracted transcript ideas into canonical ideas.

Return ONLY valid JSON with this exact shape:
{"ideas":[{"title":"Concise canonical idea","body":"Optional one or two sentence explanation","tags":["topic-tag"],"domains":["d:llm"],"sourceCandidateIdeaIds":["idea-id"],"confidence":"high","keyClaims":["Specific supported claim"],"coverageNotes":"Why these candidates are represented here"}]}

Rules:
- Use only candidate ids from the input.
- Every canonical idea must reference at least one source candidate id.
- Merge duplicates and near-duplicates.
- Do not merge ideas that are merely related but distinct.
- Preserve concrete technical meaning.
- Include keyClaims for the important distinct claims.
- Do not include markdown fences, explanations, or comments.`;

function buildConsolidationAuditPrompt(input: {
  transcript: TranscriptNode;
  candidates: CandidateIdeaPayload[];
  drafts: ConsolidatedIdeaDraft[];
}): string {
  return JSON.stringify(
    {
      task: 'audit-canonical-idea-coverage',
      transcript: {
        id: input.transcript.id,
        title: input.transcript.title,
        summary: input.transcript.summary,
        tags: input.transcript.tags,
      },
      candidates: input.candidates,
      canonicalDrafts: input.drafts.map((draft, index) => ({
        index,
        ...draft,
      })),
      instructions: [
        'Check whether every candidate idea is covered by at least one canonical draft or intentionally omitted.',
        'Mark important distinct candidates as missed when their concrete claim is absent or only weakly implied.',
        'Suggest additions only for distinct, important missed ideas supported by candidate ids.',
        'Do not suggest duplicates of existing canonical drafts.',
      ],
    },
    null,
    2,
  );
}

const CONSOLIDATION_AUDIT_SYSTEM_PROMPT = `You audit canonical idea coverage.

Return ONLY valid JSON with this exact shape:
{"coverage":[{"candidateId":"idea-id","canonicalIdeaIndexes":[0],"status":"covered","reason":"Short reason"}],"additions":[{"title":"Distinct missed idea","body":"One or two sentence explanation","tags":["topic-tag"],"domains":["d:llm"],"sourceCandidateIdeaIds":["idea-id"],"confidence":"high","keyClaims":["Specific supported claim"],"coverageNotes":"Why this was missed"}]}

Rules:
- Use only candidate ids from the input.
- canonicalIdeaIndexes are zero-based indexes from canonicalDrafts.
- status must be covered, omitted, or missed.
- Additions are only for strong, distinct missed ideas.
- Do not include markdown fences, explanations, or comments.`;

async function auditConsolidationCoverage(input: {
  transcript: TranscriptNode;
  candidates: CandidateIdeaPayload[];
  drafts: ConsolidatedIdeaDraft[];
}): Promise<{
  additions: ConsolidatedIdeaDraft[];
  coverage: ConsolidationCoverageItem[];
  llmMeta?: {
    model: string;
    provider: string;
    durationMs: number;
    promptTokens?: number;
    completionTokens?: number;
  };
}> {
  const result = await routeLlm('consolidate', buildConsolidationAuditPrompt(input), {
    system: CONSOLIDATION_AUDIT_SYSTEM_PROMPT,
    bypassCache: true,
  });
  const parsed = ConsolidationAuditResponseSchema.parse(parseJsonFromLlmText(result.text));

  return {
    additions: parsed.additions,
    coverage: parsed.coverage,
    llmMeta: {
      model: result.model,
      provider: result.provider,
      durationMs: result.durationMs,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    },
  };
}

interface ProducedNodeDeleteContext {
  nodesById: Map<string, LabNode>;
  remainingRuns: RunNode[];
  transcripts: TranscriptNode[];
  canonicalIdeas: CanonicalIdeaNode[];
}

function buildProducedNodeDeleteContext(allNodes: LabNode[], deletingRunIds: Set<string>) {
  return {
    nodesById: new Map(allNodes.map((node) => [node.id, node])),
    remainingRuns: allNodes.filter(
      (node): node is RunNode => node.type === 'run' && !deletingRunIds.has(node.id),
    ),
    transcripts: allNodes.filter((node): node is TranscriptNode => node.type === 'transcript'),
    canonicalIdeas: allNodes.filter((node): node is CanonicalIdeaNode => node.type === 'canonical-idea'),
  } satisfies ProducedNodeDeleteContext;
}

function canDeleteProducedNode(node: LabNode, context: ProducedNodeDeleteContext): boolean {
  return getProducedNodeRetentionReason(node, context) === null;
}

/** Returns a human-readable reason the node would be preserved, or null if it can be deleted. */
function getProducedNodeRetentionReason(node: LabNode, context: ProducedNodeDeleteContext): string | null {
  const referencingRun = context.remainingRuns.find((run) => run.produced_node_ids.includes(node.id));
  if (referencingRun) return `still referenced by run "${referencingRun.title}"`;

  if (node.type === 'idea') {
    const referencingIdea = context.canonicalIdeas.find((idea) =>
      idea.source_candidate_idea_ids.includes(node.id),
    );
    if (referencingIdea) return `used as a source for canonical idea "${referencingIdea.title}"`;
    return null;
  }

  if (node.type === 'transcript') {
    const referencingIdea = context.canonicalIdeas.find((idea) => idea.transcript_id === node.id);
    if (referencingIdea) return `referenced by canonical idea "${referencingIdea.title}"`;
    return null;
  }

  if (node.type === 'source') {
    const referencingTranscript = context.transcripts.find((transcript) => transcript.source_id === node.id);
    if (referencingTranscript) return `referenced by transcript "${referencingTranscript.title}"`;
    return null;
  }

  return null;
}

export const vaultAuthLogin = {
  path: '/auth/login' as const,
  handler: async (c: AppCtxJson<VaultLoginBody>) => {
    if (!isVaultAuthEnabled()) {
      return c.json({ ok: true, authRequired: false });
    }

    const { password } = c.req.valid('json');
    const expected = getVaultPassword();
    if (expected === null || password !== expected) {
      return c.json({ ok: false, error: 'Incorrect password.' }, 401);
    }

    setCookie(c, VAULT_COOKIE_NAME, password, {
      path: '/',
      maxAge: VAULT_COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: 'Lax',
    });

    return c.json({ ok: true, authRequired: true });
  },
};

export const vaultAuthLogout = {
  path: '/auth/logout' as const,
  handler: (c: AppCtx) => {
    deleteCookie(c, VAULT_COOKIE_NAME, { path: '/' });
    return c.json({ ok: true });
  },
};

export const vaultAuthSession = {
  path: '/auth/session' as const,
  handler: (c: AppCtx) => {
    if (!isVaultAuthEnabled()) {
      return c.json({ ok: true, authRequired: false });
    }

    if (!isVaultSessionValid(c)) {
      return c.json({ ok: false, authRequired: true }, 401);
    }

    return c.json({ ok: true, authRequired: true });
  },
};

export const vaultTree = {
  path: '/tree' as const,
  handler: async (c: AppCtx) => {
    const tree = await readVaultRootTree();
    return c.json({ tree });
  },
};

export const cleanRecent = {
  path: '/clean-recent' as const,
  handler: async (c: AppCtxJson<CleanRecentBody>) => {
    const { hours } = c.req.valid('json');

    try {
      const removedCount = await cleanRecentVaultActivity(hours);
      return c.json({ success: true, removedCount });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Vault clean failed.';
      return c.json({ success: false, error: message }, 500);
    }
  },
};

export const file = {
  path: '/file' as const,
  handler: async (c: AppCtx) => {
    const filePath = c.req.query('path');
    if (!filePath) return c.json({ error: '`path` query parameter is required.' }, 400);

    const resolved = resolve(VAULT_ROOT, filePath);
    if (!resolved.startsWith(VAULT_ROOT + sep) && resolved !== VAULT_ROOT) {
      return c.json({ error: 'Invalid path.' }, 403);
    }

    try {
      const content = await readFile(resolved, 'utf-8');
      return c.json({ content });
    } catch {
      return c.json({ error: 'File not found.' }, 404);
    }
  },
};

export const listVaultNodes = {
  path: '/nodes' as const,
  handler: async (c: AppCtxQuery<ListNodesQuery>) => {
    const query = c.req.valid('query');
    const nodes = await listNodes(query);
    return c.json({ nodes });
  },
};

export const createVaultNode = {
  path: '/nodes' as const,
  handler: async (c: AppCtxJson<CreateNodeBody>) => {
    const body = c.req.valid('json');
    try {
      const {
        id,
        path: createdPath,
        node,
      } = await createNode({
        type: body.type,
        title: body.title,
        body: body.body,
        tags: body.tags,
      });
      return c.json({ id, path: createdPath, type: node.type }, 201);
    } catch (err) {
      if (err instanceof Error && err.message.includes('already exists')) {
        return c.json({ error: 'A node with that title already exists.' }, 409);
      }
      return c.json({ error: 'Failed to create node.' }, 500);
    }
  },
};

export const nodeDetail = {
  path: '/nodes/:id' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();
    const nodes = await listNodes();
    const node = nodes.find((n) => n.id === id);
    if (!node) return c.json({ error: 'Node not found' }, 404);
    return c.json({ node });
  },
};

export const transcriptIdeas = {
  path: '/transcripts/:id/ideas' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();
    const allNodes = await listNodes();
    const transcript = allNodes.find((n) => n.id === id && n.type === 'transcript') as
      | TranscriptNode
      | undefined;
    if (!transcript) return c.json({ error: 'Transcript not found' }, 404);
    const ideaIds: string[] = transcript.extracted_idea_ids ?? [];
    const ideas = allNodes
      .filter((n) => n.type === 'idea' && ideaIds.includes(n.id))
      .map((n) => ({ id: n.id, title: n.title }));
    return c.json({ ideas });
  },
};

export const extractTranscript = {
  path: '/transcripts/:id/extract' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();
    const nodes = await listNodes({ type: 'transcript' });
    const node = nodes.find((n) => n.id === id) as TranscriptNode | undefined;
    if (!node) return c.json({ error: 'Transcript not found' }, 404);
    if (!node.body) return c.json({ error: 'Transcript has no body' }, 400);

    const filePath = getNodeFilePath(node.type, node.id);
    const runNodes = await listNodes({ type: 'run' });
    const matchingRuns = (runNodes as RunNode[])
      .filter((n) => n.produced_node_ids?.includes(id))
      .sort((a, b) => {
        const left = a.started_at ?? a.created_at;
        const right = b.started_at ?? b.created_at;
        return right.localeCompare(left);
      });
    const originatingRun = matchingRuns[0];

    if (originatingRun) {
      await appendRunEvent(originatingRun.id, {
        level: 'info',
        message: 'Extracting ideas from transcript',
      });
    }

    try {
      const result = await extractKnowledgeFromTranscript(id, filePath, node.body);

      // Extraction runs as a follow-on step after the originating run was persisted —
      // append the newly created idea node ids so the run's produced-node count stays accurate.
      if (originatingRun) {
        await appendProducedNodeIds(originatingRun.id, result.ideaIds, {
          completedAt: formatIsoUtcSeconds(new Date()),
        });
        await setRunLlmTrace(originatingRun.id, {
          model: result.llmMeta.model,
          provider: result.llmMeta.provider,
          duration_ms: result.llmMeta.durationMs,
          prompt_tokens: result.llmMeta.promptTokens,
          completion_tokens: result.llmMeta.completionTokens,
        });
        await appendRunEvent(originatingRun.id, {
          level: 'success',
          message: `Extracted ${result.ideaIds.length} idea${result.ideaIds.length === 1 ? '' : 's'}`,
          node_ids: result.ideaIds,
        });
      }

      return c.json({ success: true, ...result });
    } catch (err) {
      if (originatingRun) {
        await appendRunEvent(originatingRun.id, {
          level: 'warning',
          message: `Extraction failed (transcript saved): ${err instanceof Error ? err.message : String(err)}`,
        });
      }

      return c.json(
        {
          success: false,
          error: err instanceof Error ? err.message : 'Extraction failed',
        },
        500,
      );
    }
  },
};

export const consolidateTranscriptIdeas = {
  path: '/transcripts/:id/consolidate' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();
    const allNodes = await listNodes();
    const transcript = allNodes.find((node) => node.id === id && node.type === 'transcript') as
      | TranscriptNode
      | undefined;
    if (!transcript) return c.json({ error: 'Transcript not found' }, 404);

    const runs = allNodes.filter(
      (node): node is RunNode => node.type === 'run' && node.produced_node_ids.includes(transcript.id),
    );
    const ideasById = new Map(
      allNodes.filter((node): node is IdeaNode => node.type === 'idea').map((idea) => [idea.id, idea]),
    );
    const candidatesById = new Map<string, CandidateIdeaPayload>();

    for (const run of runs) {
      for (const nodeId of run.produced_node_ids) {
        const idea = ideasById.get(nodeId);
        if (!idea || candidatesById.has(idea.id)) continue;
        const { domains, topics } = splitIdeaTags(idea.tags);
        candidatesById.set(idea.id, {
          id: idea.id,
          runId: run.id,
          title: idea.title,
          body: idea.body || undefined,
          domains,
          tags: topics,
        });
      }
    }

    const candidates = [...candidatesById.values()];
    if (candidates.length === 0) {
      return c.json({ error: 'No candidate ideas found for this transcript.' }, 400);
    }

    try {
      const result = await routeLlm('consolidate', buildConsolidationPrompt(transcript, candidates), {
        system: CONSOLIDATION_SYSTEM_PROMPT,
        bypassCache: true,
      });
      const parsed = ConsolidatedIdeasResponseSchema.parse(parseJsonFromLlmText(result.text));
      const candidateIds = new Set(candidates.map((candidate) => candidate.id));
      let drafts = parsed.ideas;
      let coverage: ConsolidationCoverageItem[] = [];
      let auditMeta:
        | {
            model: string;
            provider: string;
            durationMs: number;
            promptTokens?: number;
            completionTokens?: number;
          }
        | undefined;
      let auditWarning: string | undefined;

      try {
        const audit = await auditConsolidationCoverage({ transcript, candidates, drafts });
        coverage = audit.coverage.filter((item) => candidateIds.has(item.candidateId));
        auditMeta = audit.llmMeta;
        drafts = [
          ...drafts,
          ...audit.additions.filter((addition) =>
            addition.sourceCandidateIdeaIds.some((candidateId) => candidateIds.has(candidateId)),
          ),
        ];
      } catch (err) {
        auditWarning = err instanceof Error ? err.message : 'Coverage audit failed.';
      }

      const coverageByCandidateId = new Map(coverage.map((item) => [item.candidateId, item]));
      const coveredCandidateIdsByDraftIndex = new Map<number, string[]>();
      for (const item of coverage) {
        if (item.status !== 'covered') continue;
        for (const index of item.canonicalIdeaIndexes) {
          const ids = coveredCandidateIdsByDraftIndex.get(index) ?? [];
          ids.push(item.candidateId);
          coveredCandidateIdsByDraftIndex.set(index, ids);
        }
      }
      const createdAt = new Date();
      const timestamp = formatInstantForFilenameId(createdAt);
      const canonicalIdeas: CanonicalIdeaNode[] = [];

      for (const [index, draft] of drafts.entries()) {
        const sourceCandidateIdeaIds = [
          ...new Set([
            ...draft.sourceCandidateIdeaIds,
            ...(coveredCandidateIdsByDraftIndex.get(index) ?? []),
          ]),
        ].filter((candidateId) => candidateIds.has(candidateId));
        if (sourceCandidateIdeaIds.length === 0) continue;

        const tags = dedupeTags([...draft.domains.filter((tag) => tag.startsWith('d:')), ...draft.tags]);
        const coverageNotes =
          draft.coverageNotes ||
          sourceCandidateIdeaIds
            .map((candidateId) => coverageByCandidateId.get(candidateId)?.reason)
            .filter((reason): reason is string => Boolean(reason))
            .join(' ');
        const created = await createNode({
          type: 'canonical-idea',
          id: `canonical-${transcript.id}-${index + 1}-${timestamp}`,
          title: draft.title,
          body: draft.body,
          tags,
          extra: {
            transcript_id: transcript.id,
            source_candidate_idea_ids: sourceCandidateIdeaIds,
            confidence: draft.confidence,
            key_claims: draft.keyClaims,
            coverage_notes: coverageNotes || undefined,
            llm_model: result.model,
            llm_provider: result.provider,
            llm_duration_ms: result.durationMs,
            llm_prompt_tokens: result.promptTokens,
            llm_completion_tokens: result.completionTokens,
          },
        });
        canonicalIdeas.push(created.node as CanonicalIdeaNode);
      }

      if (canonicalIdeas.length === 0) {
        return c.json({ error: 'Consolidation returned no valid canonical ideas.' }, 422);
      }

      const coveredCandidateIdeaIds = [
        ...new Set(
          canonicalIdeas.flatMap((idea) =>
            idea.source_candidate_idea_ids.filter((candidateId) => candidateIds.has(candidateId)),
          ),
        ),
      ];
      const omittedCandidateIdeaIds = coverage
        .filter((item) => item.status === 'omitted')
        .map((item) => ({ id: item.candidateId, reason: item.reason || undefined }));
      const missedCandidateIdeaIds = coverage
        .filter((item) => item.status === 'missed')
        .map((item) => ({ id: item.candidateId, reason: item.reason || undefined }));

      await updateNode(getNodeFilePath('transcript', transcript.id), (current) => ({
        ...(current as TranscriptNode),
        canonical_coverage: {
          canonical_idea_ids: canonicalIdeas.map((idea) => idea.id),
          candidate_idea_ids: candidates.map((candidate) => candidate.id),
          covered_candidate_idea_ids: coveredCandidateIdeaIds,
          omitted_candidate_idea_ids: omittedCandidateIdeaIds,
          missed_candidate_idea_ids: missedCandidateIdeaIds,
          warning: auditWarning,
          updated_at: formatIsoUtcSeconds(new Date()),
        },
      }));

      return c.json({
        success: true,
        canonicalIdeaIds: canonicalIdeas.map((idea) => idea.id),
        canonicalIdeas,
        coverageAudit: {
          coverage,
          missed: coverage.filter((item) => item.status === 'missed'),
          warning: auditWarning,
          llmMeta: auditMeta,
        },
        llmMeta: {
          model: result.model,
          provider: result.provider,
          durationMs: result.durationMs,
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
        },
      });
    } catch (err) {
      return c.json(
        {
          success: false,
          error: err instanceof Error ? err.message : 'Consolidation failed',
        },
        500,
      );
    }
  },
};

export const promoteCanonicalIdea = {
  path: '/transcripts/:id/canonical-ideas/promote' as const,
  handler: async (c: AppCtxJson<PromoteCanonicalIdeaBody>) => {
    const { id } = c.req.param() as { id: string };
    const { candidateId } = c.req.valid('json');

    const transcriptPath = getNodeFilePath('transcript', id);
    let transcript: TranscriptNode;
    try {
      transcript = (await readNode(transcriptPath)) as TranscriptNode;
    } catch {
      return c.json({ error: 'Transcript not found' }, 404);
    }

    const allNodes = await listNodes();
    const candidate = allNodes.find(
      (node): node is IdeaNode => node.type === 'idea' && node.id === candidateId,
    );
    if (!candidate) return c.json({ error: 'Candidate idea not found' }, 404);

    const alreadyCovered = (transcript.canonical_coverage?.covered_candidate_idea_ids ?? []).includes(
      candidateId,
    );
    if (alreadyCovered) {
      return c.json({ error: 'This candidate idea is already covered by a canonical idea.' }, 400);
    }

    const { domains, topics } = splitIdeaTags(candidate.tags);
    const timestamp = formatInstantForFilenameId(new Date());
    const created = await createNode({
      type: 'canonical-idea',
      id: `canonical-${transcript.id}-promoted-${timestamp}`,
      title: candidate.title,
      body: candidate.body,
      tags: dedupeTags([...domains, ...topics]),
      extra: {
        transcript_id: transcript.id,
        source_candidate_idea_ids: [candidateId],
        confidence: 'medium',
        key_claims: [],
        coverage_notes: 'Promoted from a possible missed idea.',
      },
    });
    const canonicalIdea = created.node as CanonicalIdeaNode;

    const updated = await updateNode(transcriptPath, (current) => {
      const transcriptNode = current as TranscriptNode;
      const existing = transcriptNode.canonical_coverage;
      const candidateIdeaIds = new Set(existing?.candidate_idea_ids ?? []);
      candidateIdeaIds.add(candidateId);

      return {
        ...transcriptNode,
        canonical_coverage: {
          canonical_idea_ids: [...new Set([...(existing?.canonical_idea_ids ?? []), canonicalIdea.id])],
          candidate_idea_ids: [...candidateIdeaIds],
          covered_candidate_idea_ids: [
            ...new Set([...(existing?.covered_candidate_idea_ids ?? []), candidateId]),
          ],
          omitted_candidate_idea_ids: existing?.omitted_candidate_idea_ids ?? [],
          missed_candidate_idea_ids: (existing?.missed_candidate_idea_ids ?? []).filter(
            (item) => item.id !== candidateId,
          ),
          warning: existing?.warning,
          updated_at: formatIsoUtcSeconds(new Date()),
        },
      };
    });

    return c.json({ success: true, canonicalIdea, transcript: updated.node as TranscriptNode });
  },
};

export const discardTranscript = {
  path: '/transcripts/:id' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();

    // Read directly by path — avoids listNodes scan returning stale/incomplete results
    const transcriptPath = getNodeFilePath('transcript', id);
    let transcript: TranscriptNode;
    try {
      transcript = (await readNode(transcriptPath)) as TranscriptNode;
    } catch {
      return c.json({ error: 'Transcript not found' }, 404);
    }

    // Delete idea nodes
    for (const ideaId of transcript.extracted_idea_ids ?? []) {
      try {
        await deleteNode('idea', ideaId);
      } catch {
        /* best-effort */
      }
    }

    // Delete canonical idea nodes for this transcript
    try {
      const canonicalIdeaNodes = await listNodes({ type: 'canonical-idea' });
      for (const canonicalIdea of canonicalIdeaNodes) {
        if (canonicalIdea.type !== 'canonical-idea' || canonicalIdea.transcript_id !== id) continue;
        try {
          await deleteNode('canonical-idea', canonicalIdea.id);
        } catch {
          /* best-effort */
        }
      }
    } catch {
      /* best-effort */
    }

    // Delete source node
    if (transcript.source_id) {
      try {
        await deleteNode('source', transcript.source_id);
      } catch {
        /* best-effort */
      }
    }

    // Delete associated run node (find by produced_node_ids containing this transcript)
    try {
      const runNodes = await listNodes({ type: 'run' });
      for (const n of runNodes) {
        if (n.type === 'run' && (n as RunNode).produced_node_ids?.includes(id)) {
          try {
            await deleteNode('run', n.id);
          } catch {
            /* best-effort */
          }
        }
      }
    } catch {
      /* best-effort */
    }

    await deleteNode('transcript', id);
    return c.json({ success: true });
  },
};

export const deleteRun = {
  path: '/runs/:id' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();
    const { deleteProduced: deleteProducedParam } = deleteRunQuerySchema.parse({
      deleteProduced: c.req.query('deleteProduced'),
    });
    const deleteProduced = deleteProducedParam === 'true';

    const runPath = getNodeFilePath('run', id);
    let run: RunNode;
    try {
      run = (await readNode(runPath)) as RunNode;
    } catch {
      return c.json({ error: 'Run not found' }, 404);
    }

    let deletedProduced = 0;
    if (deleteProduced && run.produced_node_ids.length > 0) {
      const allNodes = await listNodes();
      const deleteContext = buildProducedNodeDeleteContext(allNodes, new Set([run.id]));

      for (const nodeId of run.produced_node_ids) {
        const producedNode = deleteContext.nodesById.get(nodeId);
        if (!producedNode) continue;
        if (!canDeleteProducedNode(producedNode, deleteContext)) continue;

        try {
          await deleteNode(producedNode.type, nodeId);
          deletedProduced++;
        } catch {
          /* best-effort */
        }
      }
    }

    await deleteNode('run', id);
    return c.json({ success: true, deletedProduced });
  },
};

export const previewDeleteRuns = {
  path: '/runs/delete-preview' as const,
  handler: async (c: AppCtxJson<DeleteRunsPreviewBody>) => {
    const { ids } = c.req.valid('json');

    const allNodes = await listNodes();
    const runsById = new Map(
      allNodes.filter((node): node is RunNode => node.type === 'run').map((run) => [run.id, run]),
    );

    const runs: Array<{ id: string; title: string }> = [];
    const deletingRunIds = new Set<string>();
    for (const id of ids) {
      const run = runsById.get(id);
      if (!run) continue;
      runs.push({ id: run.id, title: run.title });
      deletingRunIds.add(run.id);
    }

    const deleteContext = buildProducedNodeDeleteContext(allNodes, deletingRunIds);
    const producedNodeIds = new Set(
      [...deletingRunIds].flatMap((id) => runsById.get(id)?.produced_node_ids ?? []),
    );

    const toDelete: Array<{ id: string; type: string; title: string }> = [];
    const preserved: Array<{ id: string; type: string; title: string; reason: string }> = [];

    for (const nodeId of producedNodeIds) {
      const node = deleteContext.nodesById.get(nodeId);
      if (!node) continue;
      const reason = getProducedNodeRetentionReason(node, deleteContext);
      if (reason === null) {
        toDelete.push({ id: node.id, type: node.type, title: node.title });
      } else {
        preserved.push({ id: node.id, type: node.type, title: node.title, reason });
      }
    }

    // Canonical ideas tied to transcripts/candidates produced by these runs remain untouched
    // (they are what force those nodes into `preserved`), but are surfaced for visibility.
    const canonicalIdeasAffected = deleteContext.canonicalIdeas
      .filter(
        (idea) =>
          (idea.transcript_id && producedNodeIds.has(idea.transcript_id)) ||
          idea.source_candidate_idea_ids.some((sourceId) => producedNodeIds.has(sourceId)),
      )
      .map((idea) => ({ id: idea.id, title: idea.title, transcriptId: idea.transcript_id }));

    return c.json({ runs, toDelete, preserved, canonicalIdeasAffected });
  },
};

export const enrichSource = {
  path: '/sources/:id/enrich' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();
    const force = c.req.query('force') === 'true';

    const nodes = await listNodes({ type: 'source' });
    const source = nodes.find((node) => node.id === id) as SourceNode | undefined;
    if (!source) return c.json({ error: 'Source not found' }, 404);

    try {
      const result = await enrichSourceMetadata(source, { force });
      return c.json({
        source: result.source,
        fetched: result.fetched,
        subscriptionChecked: result.subscriptionChecked,
        subscriptionError: result.subscriptionError,
      });
    } catch (err) {
      return c.json(
        {
          error: err instanceof Error ? err.message : 'Failed to enrich source metadata.',
        },
        500,
      );
    }
  },
};

export const updateSourceProfiles = {
  path: '/sources/:id/profiles' as const,
  handler: async (c: AppCtxJson<UpdateSourceProfilesBody>) => {
    const id = c.req.param('id');
    if (!id) return c.json({ error: 'Source id is required.' }, 400);
    const { profiles } = c.req.valid('json');
    const sourcePath = getNodeFilePath('source', id);

    try {
      const result = await updateNode(sourcePath, (current) => {
        if (current.type !== 'source') {
          throw new Error('Source not found');
        }

        const profilePlatforms = new Set(profiles.map((profile) => profile.platform));
        const platforms = [
          ...new Set([...current.platforms.filter((platform) => platform !== 'github'), ...profilePlatforms]),
        ];

        return {
          ...current,
          platforms,
          profiles,
        };
      });

      return c.json({ source: result.node });
    } catch (err) {
      return c.json(
        {
          error: err instanceof Error ? err.message : 'Failed to update source profiles.',
        },
        500,
      );
    }
  },
};

export const nodeRaw = {
  path: '/nodes/:id/raw' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();
    const nodes = await listNodes();
    const node = nodes.find((n) => n.id === id);
    if (!node) return c.json({ error: 'Node not found' }, 404);

    const filePath = getNodeFilePath(node.type, node.id);
    if (!filePath.startsWith(VAULT_ROOT)) return c.json({ error: 'Forbidden' }, 403);

    const content = await readFile(filePath, 'utf-8');
    return c.text(content);
  },
};
