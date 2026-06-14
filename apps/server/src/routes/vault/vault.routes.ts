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
import type { TaskType } from '@llaab/llm';
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

const ConsolidationCoverageStatusSchema = z.enum(['covered', 'omitted', 'missed']);

const CanonicalIdeaDraftSchema = z
  .object({
    title: z.string().min(1),
    body: z.string().optional().default(''),
    tags: z.array(z.string()).default([]),
    domains: z.array(z.string()).default([]),
    sourceCandidateIdeaIds: z.array(z.string().min(1)).default([]),
    source_candidate_idea_ids: z.array(z.string().min(1)).default([]),
    confidence: z.string().optional().default('medium'),
    keyClaims: z.array(z.string().min(1)).default([]),
    key_claims: z.array(z.string().min(1)).default([]),
    coverageNotes: z.string().optional().default(''),
    coverage_notes: z.string().optional().default(''),
  })
  .transform((idea) => {
    const normalizedConfidence = idea.confidence.toLocaleLowerCase().trim();
    return {
      title: idea.title,
      body: idea.body,
      tags: idea.tags,
      domains: idea.domains,
      sourceCandidateIdeaIds:
        idea.sourceCandidateIdeaIds.length > 0 ? idea.sourceCandidateIdeaIds : idea.source_candidate_idea_ids,
      confidence:
        normalizedConfidence === 'low' || normalizedConfidence === 'high' ? normalizedConfidence : 'medium',
      keyClaims: idea.keyClaims.length > 0 ? idea.keyClaims : idea.key_claims,
      coverageNotes: idea.coverageNotes || idea.coverage_notes,
    };
  })
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

const PossibleMissedIdeaSchema = z
  .object({
    title: z.string().min(1),
    reason: z.string().optional().default(''),
    sourceCandidateIdeaIds: z.array(z.string().min(1)).optional().default([]),
    source_candidate_idea_ids: z.array(z.string().min(1)).optional().default([]),
    recommendation: z
      .string()
      .optional()
      .default('supporting_detail')
      .transform((value) => {
        const normalized = value.toLocaleLowerCase().trim();
        return normalized === 'promote' || normalized === 'omit' ? normalized : 'supporting_detail';
      })
      .pipe(z.enum(['promote', 'supporting_detail', 'omit'])),
  })
  .transform((idea) => ({
    title: idea.title,
    reason: idea.reason,
    sourceCandidateIdeaIds:
      idea.sourceCandidateIdeaIds.length > 0 ? idea.sourceCandidateIdeaIds : idea.source_candidate_idea_ids,
    recommendation: idea.recommendation,
  }));

const CanonicalCoverageListsSchema = z
  .object({
    coveredCandidateIdeaIds: z.array(z.string().min(1)).optional().default([]),
    covered_candidate_idea_ids: z.array(z.string().min(1)).optional().default([]),
    omittedCandidateIdeaIds: z.array(z.string().min(1)).optional().default([]),
    omitted_candidate_idea_ids: z.array(z.string().min(1)).optional().default([]),
    missedCandidateIdeaIds: z.array(z.string().min(1)).optional().default([]),
    missed_candidate_idea_ids: z.array(z.string().min(1)).optional().default([]),
  })
  .transform((coverage) => ({
    coveredCandidateIdeaIds:
      coverage.coveredCandidateIdeaIds.length > 0
        ? coverage.coveredCandidateIdeaIds
        : coverage.covered_candidate_idea_ids,
    omittedCandidateIdeaIds:
      coverage.omittedCandidateIdeaIds.length > 0
        ? coverage.omittedCandidateIdeaIds
        : coverage.omitted_candidate_idea_ids,
    missedCandidateIdeaIds:
      coverage.missedCandidateIdeaIds.length > 0
        ? coverage.missedCandidateIdeaIds
        : coverage.missed_candidate_idea_ids,
  }));

const EMPTY_COVERAGE_LISTS = {
  coveredCandidateIdeaIds: [],
  covered_candidate_idea_ids: [],
  omittedCandidateIdeaIds: [],
  omitted_candidate_idea_ids: [],
  missedCandidateIdeaIds: [],
  missed_candidate_idea_ids: [],
};

const CanonicalDraftResultSchema = z.object({
  canonicalIdeas: z.array(CanonicalIdeaDraftSchema).default([]),
  coverage: CanonicalCoverageListsSchema.optional().default(EMPTY_COVERAGE_LISTS),
  possibleMissedIdeas: z.array(PossibleMissedIdeaSchema).optional().default([]),
});

const CanonicalAuditResultSchema = CanonicalDraftResultSchema.extend({
  auditNotes: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .default([])
    .transform((value) => (Array.isArray(value) ? value : value ? [value] : [])),
});

type CanonicalDraftResult = z.infer<typeof CanonicalDraftResultSchema>;

interface ConsolidationCoverageItem {
  candidateId: string;
  canonicalIdeaIndexes: number[];
  status: z.infer<typeof ConsolidationCoverageStatusSchema>;
  reason: string;
}

type ConsolidationMode = 'fast' | 'balanced' | 'best';

const CONSOLIDATION_MODES = new Set<ConsolidationMode>(['fast', 'balanced', 'best']);

function parseConsolidationMode(value: string | undefined): ConsolidationMode {
  return value && CONSOLIDATION_MODES.has(value as ConsolidationMode)
    ? (value as ConsolidationMode)
    : 'balanced';
}

function getConsolidationTasks(mode: ConsolidationMode): {
  draftTask: TaskType;
  auditTask: TaskType | null;
} {
  switch (mode) {
    case 'fast':
      return { draftTask: 'consolidate', auditTask: null };
    case 'best':
      return { draftTask: 'consolidate-audit', auditTask: 'consolidate-audit' };
    case 'balanced':
    default:
      return { draftTask: 'consolidate', auditTask: 'consolidate-audit' };
  }
}

interface ConsolidationStats {
  candidateRunCount: number;
  candidateIdeaCount: number;
  averageIdeasPerRun: number;
  uniqueCandidateTagCount: number;
  sourceModels: string[];
}

interface ConsolidationTarget {
  idealMin: number;
  idealMax: number;
  hardMin: number;
  hardMax: number;
}

function computeConsolidationStats(candidates: CandidateIdeaPayload[]): ConsolidationStats {
  const runIds = new Set(candidates.map((candidate) => candidate.runId));
  const tags = new Set(candidates.flatMap((candidate) => [...candidate.tags, ...candidate.domains]));
  const sourceModels = [
    ...new Set(
      candidates.map((candidate) => candidate.model).filter((model): model is string => Boolean(model)),
    ),
  ];

  return {
    candidateRunCount: runIds.size,
    candidateIdeaCount: candidates.length,
    averageIdeasPerRun: runIds.size > 0 ? candidates.length / runIds.size : candidates.length,
    uniqueCandidateTagCount: tags.size,
    sourceModels,
  };
}

function computeConsolidationTarget(candidateIdeaCount: number): ConsolidationTarget {
  return {
    idealMin: 4,
    idealMax: 6,
    hardMin: Math.max(3, Math.floor(candidateIdeaCount / 8)),
    hardMax: Math.min(8, Math.ceil(candidateIdeaCount / 4)),
  };
}

interface CandidateIdeaPayload {
  id: string;
  runId: string;
  model?: string;
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

async function callLlmForJson<T>(
  task: TaskType,
  input: string,
  system: string,
  schema: { parse: (value: unknown) => T },
  attempts = 2,
): Promise<{ llm: Awaited<ReturnType<typeof routeLlm>>; result: T }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const llm = await routeLlm(task, input, { system, bypassCache: true });
    try {
      return { llm, result: schema.parse(parseJsonFromLlmText(llm.text)) };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
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

const CANONICAL_IDEA_DRAFT_JSON_SHAPE =
  '{"canonicalIdeas":[{"title":"Concise canonical idea","body":"One or two sentence explanation",' +
  '"tags":["topic-tag"],"domains":["d:llm"],"confidence":"high","sourceCandidateIdeaIds":["idea-id"],' +
  '"keyClaims":["Specific supported claim"],"coverageNotes":"Plain-English summary of what this covers"}],' +
  '"coverage":{"coveredCandidateIdeaIds":["idea-id"],"omittedCandidateIdeaIds":["idea-id"],' +
  '"missedCandidateIdeaIds":["idea-id"]},' +
  '"possibleMissedIdeas":[{"title":"Distinct missed idea","reason":"Why it might be missing",' +
  '"sourceCandidateIdeaIds":["idea-id"],"recommendation":"promote"}]}';

const DRAFT_CONSOLIDATION_RULES = `Category Separation Rule:
Do not merge ideas that belong to different categories of concern, even if they are related. Keep separate when appropriate: workflow strategy; model behavior; historical role; interface/tooling architecture; runtime/sandboxing architecture; cost/performance implication.

Problem/Solution Merge Rule:
When one candidate idea describes a problem and another describes the recommended solution to that same problem, merge them into one canonical idea if together they form one coherent concept. Example: "dumping entire codebases into prompts wastes tokens" plus "targeted retrieval/search is more efficient" should merge into "Context stuffing should be replaced by targeted retrieval." Do not merge a problem with an idea about a different underlying concept just because it is topically related.

Context-Specific Rule:
You may merge context stuffing, massive codebase dumping, targeted retrieval, grep/code-driven search, token cost, and context retrieval efficiency into one canonical idea framed as "Replace context stuffing with targeted retrieval." Do NOT merge this with large context windows causing model non-determinism — that is a model-behavior idea and should remain separate if supported by multiple candidates.

Bash-Specific Rule:
For Bash-related ideas, prefer one canonical idea that captures both Bash as the first/foundational execution layer and Bash as limited due to missing permissions, safety controls, and sandboxing. Suggested shape: "Bash is a foundational but limited execution layer for agents." Do not always merge Bash directly into the typed-execution transition if the candidate pool supports Bash as a distinct historical bridge.

Typed/Runtime Split Rule:
Keep typed execution layers separate from runtime isolation when both are supported. These should usually be separate canonical ideas: (1) typed programmable execution layers / TypeScript SDKs, and (2) lightweight sandboxing / V8 isolates / multi-tenant runtime isolation. Typed SDKs are interface/tooling architecture; V8 isolates are runtime/infrastructure architecture.

Single-Source Rule:
Single-source candidate clusters should usually become supporting details, not canonical ideas, unless the idea is technically specific, central to the transcript, likely useful for future retrieval/linking, and not already covered by another canonical idea. When promoting a single-source idea, usually mark confidence as "medium".`;

function buildCountGuidance(target: ConsolidationTarget): string {
  return `Count Guidance:
Target output: ${target.idealMin}-${target.idealMax} canonical ideas.
Hard bounds: ${target.hardMin}-${target.hardMax} canonical ideas.
The target is a strong preference, not a quota.
Do not invent, pad, over-split, or promote weak ideas just to hit the target.
Return fewer than the target only if the candidate pool genuinely collapses into fewer durable concepts AND doing so does not merge different categories of concern.`;
}

function buildCanonicalDraftSystemPrompt(target: ConsolidationTarget): string {
  return `You consolidate extracted transcript ideas into canonical ideas.

${buildCountGuidance(target)}

${DRAFT_CONSOLIDATION_RULES}

Return ONLY valid JSON with this exact shape:
${CANONICAL_IDEA_DRAFT_JSON_SHAPE}

Rules:
- Use only candidate ids from the input.
- Every canonical idea must reference at least one source candidate id in sourceCandidateIdeaIds.
- Every candidate id must appear in exactly one of coverage.coveredCandidateIdeaIds, coverage.omittedCandidateIdeaIds, or coverage.missedCandidateIdeaIds.
- coverage.coveredCandidateIdeaIds must match the candidate ids referenced by canonicalIdeas.
- Include keyClaims for the important distinct claims.
- coverageNotes must be plain-English and user-facing — never mention drafts, audits, prompts, or the consolidation process itself.
- possibleMissedIdeas is for distinct, important candidates not represented in canonicalIdeas.
- Do not include markdown fences, explanations, or comments.
- Keep coverageNotes and reason fields short (one sentence).
- Before responding, double-check that the JSON is syntactically valid: every string is quoted and escaped, and every object/array is closed.`;
}

function buildCanonicalDraftInput(
  transcript: TranscriptNode,
  candidates: CandidateIdeaPayload[],
  stats: ConsolidationStats,
  target: ConsolidationTarget,
): string {
  return JSON.stringify(
    {
      transcript: {
        id: transcript.id,
        title: transcript.title,
        summary: transcript.summary,
        tags: transcript.tags,
      },
      stats,
      target,
      candidateIdeas: candidates,
    },
    null,
    2,
  );
}

const AUDIT_RESPONSIBILITIES = `Check the draft canonical ideas for:
1. Are any canonical ideas duplicates?
2. Are distinct concepts over-merged?
3. Are related problem/solution pairs unnecessarily split?
4. Are important candidate clusters missing?
5. Are weak/single-source ideas promoted unnecessarily?
6. Are sourceCandidateIdeaIds accurate?
7. Is the final count within the target range?
8. Are tags clean and reusable (max 5 semantic tags, max 3 domain tags)?
9. Are domain tags appropriate (avoid noisy tags like d:ingest unless the idea is about ingestion)?
10. Do coverageNotes avoid internal process language (no "draft", "audit", "prompt", "internal", "consolidation process")?`;

function buildCanonicalAuditSystemPrompt(target: ConsolidationTarget): string {
  return `You audit and refine a draft set of canonical ideas consolidated from transcript candidate ideas.

${buildCountGuidance(target)}

${DRAFT_CONSOLIDATION_RULES}

${AUDIT_RESPONSIBILITIES}

Do not re-run consolidation from scratch unless the draft is fundamentally broken. Make targeted corrections and return the finalized canonical ideas.

Return ONLY valid JSON with this exact shape:
${CANONICAL_IDEA_DRAFT_JSON_SHAPE.replace(/\}$/, ',"auditNotes":["Short note about a correction made, if any"]}')}

Rules:
- Use only candidate ids from the input.
- Every canonical idea must reference at least one source candidate id in sourceCandidateIdeaIds.
- Every candidate id must appear in exactly one of coverage.coveredCandidateIdeaIds, coverage.omittedCandidateIdeaIds, or coverage.missedCandidateIdeaIds.
- coverageNotes must be plain-English and user-facing — never mention drafts, audits, prompts, or the consolidation process itself.
- auditNotes is for your own summary of what changed (or empty if nothing changed) — it is not shown to end users.
- Do not include markdown fences, explanations, or comments.
- Keep coverageNotes and reason fields short (one sentence).
- Before responding, double-check that the JSON is syntactically valid: every string is quoted and escaped, and every object/array is closed.`;
}

function buildCanonicalAuditInput(
  transcript: TranscriptNode,
  candidates: CandidateIdeaPayload[],
  stats: ConsolidationStats,
  draft: CanonicalDraftResult,
): string {
  return JSON.stringify(
    {
      transcript: {
        id: transcript.id,
        title: transcript.title,
        summary: transcript.summary,
        tags: transcript.tags,
      },
      stats,
      candidateIdeas: candidates,
      draft,
    },
    null,
    2,
  );
}

const BANNED_COVERAGE_NOTE_PHRASES = [
  'draft 0',
  'draft 1',
  'draft 2',
  'audit',
  'prompt',
  'internal',
  'consolidation process',
  'overarching narrative formed by combining drafts',
];

const FALLBACK_COVERAGE_NOTE = 'Covers related candidate ideas about this concept.';

function sanitizeCoverageNotes(note: string): string {
  const trimmed = note.trim();
  if (trimmed.length === 0) return FALLBACK_COVERAGE_NOTE;
  const lower = trimmed.toLocaleLowerCase();
  if (BANNED_COVERAGE_NOTE_PHRASES.some((phrase) => lower.includes(phrase))) return FALLBACK_COVERAGE_NOTE;
  return trimmed;
}

const DOMAIN_TAG_ALIASES: Record<string, string> = {
  'd:infrastructure': 'd:infra',
};

const MAX_SEMANTIC_TAGS = 5;
const MAX_DOMAIN_TAGS = 3;

function normalizeCanonicalTags(
  tags: string[],
  domains: string[],
  title: string,
  body: string,
): { tags: string[]; domains: string[] } {
  const text = `${title} ${body}`.toLocaleLowerCase();
  const isAboutIngestion = text.includes('ingest');

  const normalizedDomains = dedupeTags(domains.map((tag) => DOMAIN_TAG_ALIASES[normalizeTag(tag)] ?? tag))
    .filter((tag) => tag !== 'd:ingest' || isAboutIngestion)
    .slice(0, MAX_DOMAIN_TAGS);

  const normalizedTags = dedupeTags(tags.filter((tag) => !tag.startsWith('d:'))).slice(0, MAX_SEMANTIC_TAGS);

  return { tags: normalizedTags, domains: normalizedDomains };
}

function buildLegacyCoverage(
  candidates: CandidateIdeaPayload[],
  result: CanonicalDraftResult,
): ConsolidationCoverageItem[] {
  const missedReasonByCandidateId = new Map<string, string>();
  for (const missed of result.possibleMissedIdeas) {
    for (const candidateId of missed.sourceCandidateIdeaIds) {
      if (!missedReasonByCandidateId.has(candidateId)) {
        missedReasonByCandidateId.set(candidateId, missed.reason);
      }
    }
  }

  return candidates.map((candidate) => {
    const canonicalIdeaIndexes = result.canonicalIdeas
      .map((idea, index) => (idea.sourceCandidateIdeaIds.includes(candidate.id) ? index : -1))
      .filter((index) => index >= 0);

    let status: ConsolidationCoverageItem['status'];
    if (canonicalIdeaIndexes.length > 0 || result.coverage.coveredCandidateIdeaIds.includes(candidate.id)) {
      status = 'covered';
    } else if (result.coverage.missedCandidateIdeaIds.includes(candidate.id)) {
      status = 'missed';
    } else {
      status = 'omitted';
    }

    return {
      candidateId: candidate.id,
      canonicalIdeaIndexes,
      status,
      reason: missedReasonByCandidateId.get(candidate.id) ?? '',
    };
  });
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
          model: idea.llm_model,
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

    const mode = parseConsolidationMode(c.req.query('mode'));
    const { draftTask, auditTask } = getConsolidationTasks(mode);
    const candidateIds = new Set(candidates.map((candidate) => candidate.id));
    const stats = computeConsolidationStats(candidates);
    const target = computeConsolidationTarget(stats.candidateIdeaCount);

    try {
      const { llm: draftLlm, result: draftResult } = await callLlmForJson(
        draftTask,
        buildCanonicalDraftInput(transcript, candidates, stats, target),
        buildCanonicalDraftSystemPrompt(target),
        CanonicalDraftResultSchema,
      );
      let result: CanonicalDraftResult = draftResult;
      let finalLlm = draftLlm;
      let auditNotes: string[] = [];
      let auditWarning: string | undefined;

      if (auditTask) {
        try {
          const { llm: auditLlm, result: audited } = await callLlmForJson(
            auditTask,
            buildCanonicalAuditInput(transcript, candidates, stats, result),
            buildCanonicalAuditSystemPrompt(target),
            CanonicalAuditResultSchema,
          );
          result = audited;
          auditNotes = audited.auditNotes;
          finalLlm = auditLlm;
        } catch (err) {
          auditWarning = err instanceof Error ? err.message : 'Canonical idea audit failed.';
        }
      }

      const createdAt = new Date();
      const timestamp = formatInstantForFilenameId(createdAt);
      const canonicalIdeas: CanonicalIdeaNode[] = [];

      for (const [index, draft] of result.canonicalIdeas.entries()) {
        const sourceCandidateIdeaIds = draft.sourceCandidateIdeaIds.filter((candidateId) =>
          candidateIds.has(candidateId),
        );
        if (sourceCandidateIdeaIds.length === 0) continue;

        const { tags, domains } = normalizeCanonicalTags(draft.tags, draft.domains, draft.title, draft.body);
        const created = await createNode({
          type: 'canonical-idea',
          id: `canonical-${transcript.id}-${index + 1}-${timestamp}`,
          title: draft.title,
          body: draft.body,
          tags: dedupeTags([...domains, ...tags]),
          extra: {
            transcript_id: transcript.id,
            source_candidate_idea_ids: sourceCandidateIdeaIds,
            confidence: draft.confidence,
            key_claims: draft.keyClaims,
            coverage_notes: sanitizeCoverageNotes(draft.coverageNotes),
            llm_model: finalLlm.model,
            llm_provider: finalLlm.provider,
            llm_duration_ms: finalLlm.durationMs,
            llm_prompt_tokens: finalLlm.promptTokens,
            llm_completion_tokens: finalLlm.completionTokens,
          },
        });
        canonicalIdeas.push(created.node as CanonicalIdeaNode);
      }

      if (canonicalIdeas.length === 0) {
        return c.json({ error: 'Consolidation returned no valid canonical ideas.' }, 422);
      }

      const coverage = buildLegacyCoverage(candidates, result);
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

      const warning = [auditWarning, ...auditNotes].filter(Boolean).join(' ') || undefined;

      await updateNode(getNodeFilePath('transcript', transcript.id), (current) => ({
        ...(current as TranscriptNode),
        canonical_coverage: {
          canonical_idea_ids: canonicalIdeas.map((idea) => idea.id),
          candidate_idea_ids: candidates.map((candidate) => candidate.id),
          covered_candidate_idea_ids: coveredCandidateIdeaIds,
          omitted_candidate_idea_ids: omittedCandidateIdeaIds,
          missed_candidate_idea_ids: missedCandidateIdeaIds,
          warning,
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
          warning,
        },
        llmMeta: {
          model: finalLlm.model,
          provider: finalLlm.provider,
          durationMs: finalLlm.durationMs,
          promptTokens: finalLlm.promptTokens,
          completionTokens: finalLlm.completionTokens,
        },
        mode,
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
