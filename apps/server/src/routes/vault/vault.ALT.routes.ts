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
  ListNodesQuery,
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
  return JSON.parse(stripped.slice(start, end + 1));
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

interface ConsolidationStats {
  candidateRunCount: number;
  candidateIdeaCount: number;
  averageIdeasPerRun: number;
  uniqueCandidateTagCount: number;
  sourceModels: string[];
}

interface CanonicalIdeaTargetRange {
  minCanonicalIdeas: number;
  maxCanonicalIdeas: number;
  idealMin: number;
  idealMax: number;
}

function computeConsolidationStats(candidates: CandidateIdeaPayload[], runs: RunNode[]): ConsolidationStats {
  const candidateRunCount = new Set(candidates.map((candidate) => candidate.runId)).size;
  const candidateIdeaCount = candidates.length;
  const uniqueCandidateTagCount = new Set(
    candidates.flatMap((candidate) => [...candidate.tags, ...candidate.domains]),
  ).size;
  const sourceModels = [
    ...new Set(
      runs.map((run) => run.llm?.model ?? run.model_used).filter((model): model is string => Boolean(model)),
    ),
  ];

  return {
    candidateRunCount,
    candidateIdeaCount,
    averageIdeasPerRun: candidateRunCount > 0 ? candidateIdeaCount / candidateRunCount : 0,
    uniqueCandidateTagCount,
    sourceModels,
  };
}

function computeCanonicalIdeaTargetRange(candidateIdeaCount: number): CanonicalIdeaTargetRange {
  const maxCanonicalIdeas = Math.min(8, Math.max(3, Math.ceil(candidateIdeaCount / 4)));
  const minCanonicalIdeas = Math.min(maxCanonicalIdeas, Math.max(1, Math.floor(candidateIdeaCount / 7)));
  const idealMax = Math.min(6, maxCanonicalIdeas);
  const idealMin = Math.max(minCanonicalIdeas, Math.min(4, idealMax));

  return { minCanonicalIdeas, maxCanonicalIdeas, idealMin, idealMax };
}

function buildConsolidationPrompt(
  transcript: TranscriptNode,
  candidates: CandidateIdeaPayload[],
  stats: ConsolidationStats,
  targetRange: CanonicalIdeaTargetRange,
): string {
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
      stats,
      targetCanonicalIdeaCount: targetRange,
      instructions: [
        `Target ${targetRange.idealMin}-${targetRange.idealMax} canonical ideas for this transcript.`,
        `Hard bounds: ${targetRange.minCanonicalIdeas}-${targetRange.maxCanonicalIdeas} canonical ideas.`,
        'Produce fewer than the ideal range only if the candidate pool clearly collapses into fewer strong concepts.',
        'Produce more than the ideal range only if the extra ideas are clearly independent, source-supported, and useful as future graph nodes.',
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

Core principle:
- Canonical ideas should be broader than individual candidates, narrower than a full transcript summary,
  useful as long-lived knowledge graph nodes, non-duplicative, source-supported, and granular enough for
  future linking/search.
- Do not optimize purely for minimum count or purely for exhaustive coverage. Optimize for the best
  durable canonical idea set, using the target count range provided in the input.

Count control:
- The input includes "stats" (candidate/run counts) and "targetCanonicalIdeaCount" with idealMin/idealMax
  and minCanonicalIdeas/maxCanonicalIdeas.
- The target range is a strong preference, not a hard quota in either direction. Do not invent, pad,
  over-split, or promote a weak/single-source idea solely to reach idealMin or minCanonicalIdeas. Do not
  collapse distinct categories of concern into one idea solely to reach idealMax or below.
- Return fewer than idealMin only if the candidate pool genuinely collapses into fewer durable concepts
  AND doing so does not merge ideas that belong to different categories of concern (see "Don't
  over-merge" below). Return more than idealMax only if the extra ideas are clearly independent,
  source-supported, and useful as future graph nodes.
- If your final count falls outside the ideal range, do not reference target counts, ranges, draft
  numbers, or this prompt's rules in any user-facing text (title, body, coverageNotes, keyClaims).

Merge rules:
- Merge candidate ideas that express the same underlying concept in different wording, even if the
  phrasing or emphasis differs.
- Do not automatically merge ideas that are merely related but conceptually distinct (e.g. one is an
  operational/workflow strategy and the other is a separate claim about underlying behavior) — keep these
  separate if both are well-supported.

Don't over-merge:
- Each candidate idea belongs to some underlying category of concern (e.g. a workflow practice, a tooling
  or interface design choice, a runtime/infrastructure design choice, a model-behavior claim, a
  cost/efficiency claim, a risk or limitation). Two candidates only belong in the same canonical idea if
  they share both the same underlying concept AND the same category of concern.
- When in doubt between one broader idea and two narrower ones, prefer keeping distinct categories of
  concern as separate canonical ideas, even if they are topically related. A canonical idea that silently
  blends, for example, a workflow recommendation with an unrelated model-behavior claim (or any similar
  cross-category blend) is a sign of over-merging — keep those as separate canonical ideas instead.

Problem/solution rule:
- When one candidate idea describes a problem and another describes the recommended solution to that
  same problem, and together they form one coherent concept, merge them into a single canonical idea
  framed as "<problem> should be addressed with <solution>" rather than two separate ideas.
- Do not merge a problem with an idea that is about a different underlying concept just because it is
  topically related — only merge problem/solution pairs that describe the same concept from two angles.

Split rules:
- Split a canonical idea when one title/body is carrying two independently useful knowledge nodes that
  belong to different categories of concern (e.g. one is about interface/tooling design and the other is
  about runtime/infrastructure design) — these should be separate canonical ideas even though related.
- Do not split a problem from its recommended solution when they form one coherent concept (see
  problem/solution rule above) — that is over-splitting, not a useful split.

Single-source rule:
- Single-source candidate clusters should usually be treated as supporting details, not promoted to
  canonical ideas.
- A single-source idea may become canonical only if it is technically specific, central to the
  transcript, likely useful for future retrieval/linking, and not already covered by another canonical
  idea. When promoting a single-source idea, set confidence to "medium" unless it is clearly central.

Tag rules:
- Prefer stable, reusable topic tags (e.g. context-management, token-efficiency, agent-infrastructure,
  runtime-isolation, typed-execution, sandboxing).
- Avoid overly narrow one-off tags (e.g. cool-demo, interesting-example, theo-method, general-ai) unless
  technically important.
- Keep domain tags (e.g. d:llm, d:infra, d:automation, d:integration) in "domains", separate from topic
  tags.
- Each canonical idea must have no more than 5 non-domain tags.

Confidence rules:
- "high": supported by multiple candidate ideas, appears across multiple extraction runs, or central to
  the transcript thesis.
- "medium": supported by one candidate idea, technically useful but not central, or likely valid but not
  heavily repeated.
- "low": weakly supported, inferred, or possibly off-topic/example-specific. Prefer omitting low-confidence
  ideas rather than promoting them.

General rules:
- Use only candidate ids from the input.
- Every canonical idea must reference at least one source candidate id and have a body of 1-2 sentences.
- Preserve concrete technical meaning.
- Include keyClaims (1-3) for the important distinct claims.
- Do not duplicate another canonical idea, and do not include an idea that is merely a named example
  unless the example is structurally important.
- coverageNotes must be written in plain language about the idea's content (e.g. what it covers, why it
  is distinct). Never reference internal labels such as "draft", "candidate index", numeric indexes, or
  this prompt's instructions.
- Do not include markdown fences, explanations, or comments.`;

function buildConsolidationAuditPrompt(input: {
  transcript: TranscriptNode;
  candidates: CandidateIdeaPayload[];
  drafts: ConsolidatedIdeaDraft[];
  targetRange: CanonicalIdeaTargetRange;
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
      targetCanonicalIdeaCount: input.targetRange,
      instructions: [
        'Check whether every candidate idea is covered by at least one canonical draft or intentionally omitted.',
        'Mark important distinct candidates as missed when their concrete claim is absent or only weakly implied.',
        'Suggest additions only for distinct, important missed ideas supported by candidate ids.',
        'Do not suggest duplicates of existing canonical drafts, and do not suggest merging or splitting drafts here.',
        'Consider whether the current draft count plus additions would still fall within targetCanonicalIdeaCount; prefer omitting weak additions that would push the set above maxCanonicalIdeas.',
        'minCanonicalIdeas is a floor, not a quota: do not suggest an addition merely because the draft count is below idealMin or minCanonicalIdeas.',
      ],
    },
    null,
    2,
  );
}

const CONSOLIDATION_AUDIT_SYSTEM_PROMPT = `You audit canonical idea coverage.

Return ONLY valid JSON with this exact shape:
{"coverage":[{"candidateId":"idea-id","canonicalIdeaIndexes":[0],"status":"covered","reason":"Short reason"}],"additions":[{"title":"Distinct missed idea","body":"One or two sentence explanation","tags":["topic-tag"],"domains":["d:llm"],"sourceCandidateIdeaIds":["idea-id"],"confidence":"high","keyClaims":["Specific supported claim"],"coverageNotes":"Why this was missed"}]}

Audit checks:
- Are any candidate clusters important but missing from the canonical drafts?
- Are any single-source candidates promoted unnecessarily (see single-source rule)?
- Would the final count (drafts plus approved additions) stay within targetCanonicalIdeaCount?

Rules:
- Use only candidate ids from the input.
- canonicalIdeaIndexes are zero-based indexes from canonicalDrafts, used only as array indexes in the
  JSON response.
- status must be covered, omitted, or missed.
- Additions are only for strong, distinct missed ideas not already represented by a draft.
- "reason" and any addition "coverageNotes" are shown to end users: write them in plain language about
  the candidate idea's content. Never reference internal labels such as "draft", numeric indexes, or this
  prompt's instructions.
- Do not include markdown fences, explanations, or comments.`;

async function auditConsolidationCoverage(input: {
  transcript: TranscriptNode;
  candidates: CandidateIdeaPayload[];
  drafts: ConsolidatedIdeaDraft[];
  targetRange: CanonicalIdeaTargetRange;
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
  const isReferencedByRemainingRun = context.remainingRuns.some((run) =>
    run.produced_node_ids.includes(node.id),
  );
  if (isReferencedByRemainingRun) return false;

  if (node.type === 'idea') {
    return !context.canonicalIdeas.some((idea) => idea.source_candidate_idea_ids.includes(node.id));
  }

  if (node.type === 'transcript') {
    return !context.canonicalIdeas.some((idea) => idea.transcript_id === node.id);
  }

  if (node.type === 'source') {
    return !context.transcripts.some((transcript) => transcript.source_id === node.id);
  }

  return true;
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

    const stats = computeConsolidationStats(candidates, runs);
    const targetRange = computeCanonicalIdeaTargetRange(stats.candidateIdeaCount);

    try {
      const result = await routeLlm(
        'consolidate',
        buildConsolidationPrompt(transcript, candidates, stats, targetRange),
        {
          system: CONSOLIDATION_SYSTEM_PROMPT,
          bypassCache: true,
        },
      );
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
        const audit = await auditConsolidationCoverage({ transcript, candidates, drafts, targetRange });
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
