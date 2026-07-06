import { createNode, deleteNode, getNodeFilePath, listNodes, readNode, updateNode } from '@llaab/core';
import { extractKnowledgeFromTranscript } from '@llaab/ingestion';
import { resolveLlmRoute, routeLlm } from '@llaab/llm';
import {
  formatConsolidationQualityWarning,
  formatInstantForFilenameId,
  formatIsoUtcSeconds,
  validateConsolidationQuality,
} from '@llaab/schemas';
import { appendProducedNodeIds, appendRunEvent, runSkill, setRunLlmTrace } from '@llaab/skills';
import { z } from 'zod';
import type { AppCtx, AppCtxJson } from '../../types/app.types.js';
import type { PromoteCanonicalIdeaBody, ResolveCanonicalIdeaConflictBody } from './vault.schema.js';
import type { LlmProgress, TaskType } from '@llaab/llm';
import type {
  CanonicalIdeaNode,
  ConsolidationQualityCanonical,
  IdeaNode,
  RunNode,
  TranscriptNode,
} from '@llaab/schemas';

// ---------------------------------------------------------------------------
// Zod schemas — LLM output shapes
// ---------------------------------------------------------------------------

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

type CanonicalDraftResult = z.infer<typeof CanonicalDraftResultSchema>;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface ConsolidationCoverageItem {
  candidateId: string;
  canonicalIdeaIndexes: number[];
  status: z.infer<typeof ConsolidationCoverageStatusSchema>;
  reason: string;
}

type ConsolidationMode = 'fast' | 'single-26b';

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

interface CandidateIdeaPayload {
  id: string;
  runId: string;
  model?: string;
  title: string;
  body?: string;
  domains: string[];
  tags: string[];
}

export interface ConsolidateTranscriptIdeasOptions {
  transcriptId: string;
  mode?: string;
  autoRetry?: boolean;
}

export interface ConsolidateTranscriptIdeasResult {
  success: true;
  producedNodeIds: string[];
  canonicalIdeaIds: string[];
  canonicalIdeas: CanonicalIdeaNode[];
  coverageAudit: unknown;
  qualityValidation: unknown;
  llmMeta: unknown;
  mode: ConsolidationMode;
  conflict: boolean;
  existingCanonicalIdeaIds?: string[];
  existingQualityScore?: number;
  pendingCoverage?: TranscriptNode['canonical_coverage'];
}

export class ConsolidateTranscriptIdeasError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 | 500 = 500,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Mode helpers
// ---------------------------------------------------------------------------

const LEGACY_CONSOLIDATION_MODES: Record<string, ConsolidationMode> = {
  balanced: 'single-26b',
  best: 'single-26b',
};

function parseConsolidationMode(value: string | undefined): ConsolidationMode {
  if (value === 'fast' || value === 'single-26b') return value;
  if (value && value in LEGACY_CONSOLIDATION_MODES) return LEGACY_CONSOLIDATION_MODES[value]!;
  return 'single-26b';
}

function getConsolidationConfig(mode: ConsolidationMode): {
  promptStyle: 'full' | 'compact';
  modelOverride?: string;
} {
  if (mode === 'fast') {
    return {
      promptStyle: 'full',
      modelOverride: resolveLlmRoute('extract').model,
    };
  }
  return { promptStyle: 'compact' };
}

// ---------------------------------------------------------------------------
// Stats / target helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// LLM call helpers
// ---------------------------------------------------------------------------

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
  modelOverride?: string,
  onProgress?: (progress: LlmProgress) => void | Promise<void>,
): Promise<{ llm: Awaited<ReturnType<typeof routeLlm>>; result: T }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const llm = await routeLlm(task, input, {
      system,
      bypassCache: true,
      model: modelOverride,
      onProgress,
    });
    try {
      return { llm, result: schema.parse(parseJsonFromLlmText(llm.text)) };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Tag helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Coverage helpers
// ---------------------------------------------------------------------------

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

function buildValidationCanonicalIdeas(
  result: CanonicalDraftResult,
  candidateIds: Set<string>,
): ConsolidationQualityCanonical[] {
  const ideas: ConsolidationQualityCanonical[] = [];

  for (const draft of result.canonicalIdeas) {
    const sourceCandidateIdeaIds = draft.sourceCandidateIdeaIds.filter((candidateId) =>
      candidateIds.has(candidateId),
    );
    if (sourceCandidateIdeaIds.length === 0) continue;

    const { tags, domains } = normalizeCanonicalTags(draft.tags, draft.domains, draft.title, draft.body);
    ideas.push({
      title: draft.title,
      body: draft.body,
      tags: dedupeTags([...domains, ...tags]),
      keyClaims: draft.keyClaims,
      sourceCandidateIdeaIds,
    });
  }

  return ideas;
}

// ---------------------------------------------------------------------------
// Coverage notes sanitisation
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

const CANONICAL_IDEA_DRAFT_JSON_SHAPE =
  '{"canonicalIdeas":[{"title":"Concise canonical idea","body":"One or two sentence explanation",' +
  '"tags":["topic-tag"],"domains":["d:llm"],"confidence":"high","sourceCandidateIdeaIds":["idea-id"],' +
  '"keyClaims":["Specific supported claim"],"coverageNotes":"Plain-English summary of what this covers"}],' +
  '"coverage":{"coveredCandidateIdeaIds":["idea-id"],"omittedCandidateIdeaIds":["idea-id"],' +
  '"missedCandidateIdeaIds":["idea-id"]},' +
  '"possibleMissedIdeas":[{"title":"Distinct missed idea","reason":"Why it might be missing",' +
  '"sourceCandidateIdeaIds":["idea-id"],"recommendation":"promote"}]}';

const CANONICAL_PROMOTION_RULES = `Canonical Promotion Rules:
Canonical ideas are durable graph nodes, not a complete list of interesting details.

Promote a candidate cluster only when it represents a reusable principle, workflow pattern, architectural pattern, failure mode, or decision rule.

Merge examples, tactics, tools, anecdotes, and implementation details into broader canonical ideas unless they change the reusable lesson.

When source material discusses quota limits, account switching, provider constraints, or similar tactics, describe the idea neutrally as a constraint, risk, or observed workflow pattern rather than as an endorsement.`;

const DRAFT_CONSOLIDATION_RULES = `Category Separation Rule:
Do not merge ideas that belong to different categories of concern, even if they are related. Keep separate when appropriate: workflow strategy; model behavior; historical role; interface/tooling architecture; runtime/sandboxing architecture; cost/performance implication.

Granularity Split Rule:
If two candidates answer different durable questions, keep them separate even when they share the same topic. Split when one idea is primarily about mechanism or technique, another is about operational trade-offs, and another is about human/stakeholder role. Merge only when the combined canonical idea would still have one clear thesis rather than a bundle of related implications.

Problem/Solution Merge Rule:
When one candidate idea describes a problem and another describes the recommended solution to that same problem, merge them into one canonical idea if together they form one coherent concept. Example: "dumping entire codebases into prompts wastes tokens" plus "targeted retrieval/search is more efficient" should merge into "Context stuffing should be replaced by targeted retrieval." Do not merge a problem with an idea about a different underlying concept just because it is topically related.

Context-Specific Rule:
You may merge context stuffing, massive codebase dumping, targeted retrieval, grep/code-driven search, token cost, and context retrieval efficiency into one canonical idea framed as "Replace context stuffing with targeted retrieval." Do NOT merge this with large context windows causing model non-determinism — that is a model-behavior idea and should remain separate if supported by multiple candidates.

Non-Determinism Separation Rule:
Do not treat non-determinism as merely a side-effect inside the targeted retrieval idea. If supported by multiple candidates, promote it to its own canonical idea about model behavior. That idea should use a non-determinism or model-behavior tag and source the non-determinism candidate ids directly — not only mention non-determinism inside a broader context-optimization card.

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

${CANONICAL_PROMOTION_RULES}

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

function buildCanonicalCompactSystemPrompt(target: ConsolidationTarget): string {
  return `You consolidate extracted candidate ideas into durable canonical ideas.

${buildCountGuidance(target)}

${CANONICAL_PROMOTION_RULES}

Do not optimize for minimum count. Do not pad to hit the target.
Merge duplicates. Preserve distinct knowledge nodes.

Important separation rules:
1. Merge context stuffing and targeted retrieval into one idea if they describe the same problem/solution pair.
2. Keep candidates separate when they answer different durable questions: mechanism/technique, operational trade-offs, and human/stakeholder role are usually different canonical ideas when supported.
3. Keep LLM non-determinism from large context windows separate from targeted retrieval. Do not treat non-determinism as merely a side-effect inside the retrieval idea — if supported by multiple candidates, it must become its own canonical idea about model behavior with a non-determinism or model-behavior tag.
4. Capture Bash as a foundational but limited execution layer if supported.
5. Keep typed programmable execution layers separate from runtime isolation (e.g. V8 isolates) when both are supported.
6. Single-source ideas should usually be supporting details, unless technically central and useful for future linking.

Return ONLY valid JSON with this exact shape:
${CANONICAL_IDEA_DRAFT_JSON_SHAPE}

For each canonical idea:
- title: concise, max ~100 characters.
- body: max 45 words.
- tags: max 4 semantic tags.
- domains: max 3 "d:" tags.
- keyClaims: max 2.
- coverageNotes: one plain-English sentence — never mention drafts, audits, prompts, or the consolidation process itself.

Rules:
- Use only candidate ids from the input.
- Every canonical idea must reference at least one source candidate id in sourceCandidateIdeaIds.
- Every candidate id must appear in exactly one of coverage.coveredCandidateIdeaIds, coverage.omittedCandidateIdeaIds, or coverage.missedCandidateIdeaIds.
- coverage.coveredCandidateIdeaIds must match the candidate ids referenced by canonicalIdeas.
- possibleMissedIdeas is for distinct, important candidates not represented in canonicalIdeas.
- Do not include markdown fences, explanations, or comments.
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

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

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

export async function consolidateTranscriptIdeasForTranscript(
  options: ConsolidateTranscriptIdeasOptions,
): Promise<ConsolidateTranscriptIdeasResult> {
  const { transcriptId } = options;
  const allNodes = await listNodes();
  const transcript = allNodes.find((node) => node.id === transcriptId && node.type === 'transcript') as
    | TranscriptNode
    | undefined;
  if (!transcript) throw new ConsolidateTranscriptIdeasError('Transcript not found', 404);

  const previousCoverage = transcript.canonical_coverage;

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
    throw new ConsolidateTranscriptIdeasError('No candidate ideas found for this transcript.', 400);
  }

  const mode = parseConsolidationMode(options.mode);
  const skipAutoRetry = options.autoRetry === false;
  const { promptStyle, modelOverride } = getConsolidationConfig(mode);
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  const stats = computeConsolidationStats(candidates);
  const target = computeConsolidationTarget(stats.candidateIdeaCount);
  const systemPrompt =
    promptStyle === 'compact'
      ? buildCanonicalCompactSystemPrompt(target)
      : buildCanonicalDraftSystemPrompt(target);
  const draftInput = buildCanonicalDraftInput(transcript, candidates, stats, target);

  const { record, result: skillResult } = await runSkill(
    'consolidate-canonical-ideas',
    async (_input, runNodeId) => {
      const consolidationRoute = resolveLlmRoute('consolidate', modelOverride);
      const updateLlmProgress = async (progress: LlmProgress) => {
        await setRunLlmTrace(runNodeId, {
          model: consolidationRoute.model,
          provider: consolidationRoute.provider,
          progress_status: progress.status,
          progress_tokens: progress.completionTokens,
        });
      };

      async function runDraftPass() {
        return callLlmForJson(
          'consolidate',
          draftInput,
          systemPrompt,
          CanonicalDraftResultSchema,
          2,
          modelOverride,
          updateLlmProgress,
        );
      }

      let { llm, result: draftResult } = await runDraftPass();
      let validationIdeas = buildValidationCanonicalIdeas(draftResult, candidateIds);
      let qualityValidation = validateConsolidationQuality(
        candidates,
        validationIdeas,
        validationIdeas.flatMap((idea) => idea.sourceCandidateIdeaIds),
      );

      if (!qualityValidation.passed && !skipAutoRetry) {
        await appendRunEvent(runNodeId, {
          level: 'info',
          message: 'Quality check failed — retrying consolidation pass',
        });
        const retry = await runDraftPass();
        llm = retry.llm;
        draftResult = retry.result;
        validationIdeas = buildValidationCanonicalIdeas(draftResult, candidateIds);
        qualityValidation = validateConsolidationQuality(
          candidates,
          validationIdeas,
          validationIdeas.flatMap((idea) => idea.sourceCandidateIdeaIds),
        );
      }

      const result: CanonicalDraftResult = draftResult;

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
            llm_model: llm.model,
            llm_provider: llm.provider,
            llm_duration_ms: llm.durationMs,
            llm_prompt_tokens: llm.promptTokens,
            llm_completion_tokens: llm.completionTokens,
          },
        });
        canonicalIdeas.push(created.node as CanonicalIdeaNode);
      }

      if (canonicalIdeas.length === 0) {
        throw new Error('Consolidation returned no valid canonical ideas.');
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

      const qualityWarning = formatConsolidationQualityWarning(qualityValidation);
      const warning = qualityWarning || undefined;

      const newCoverage: TranscriptNode['canonical_coverage'] = {
        canonical_idea_ids: canonicalIdeas.map((idea) => idea.id),
        candidate_idea_ids: candidates.map((candidate) => candidate.id),
        covered_candidate_idea_ids: coveredCandidateIdeaIds,
        omitted_candidate_idea_ids: omittedCandidateIdeaIds,
        missed_candidate_idea_ids: missedCandidateIdeaIds,
        quality_score: qualityValidation.score,
        warning,
        updated_at: formatIsoUtcSeconds(new Date()),
      };

      // An existing canonical-idea set means this run produced a *second*, conflicting set —
      // leave the transcript's coverage pointed at the existing set until the client confirms
      // which one to keep, rather than silently piling sets up (the previous behavior).
      const hasExistingSet = Boolean(previousCoverage?.canonical_idea_ids.length);
      if (!hasExistingSet) {
        await updateNode(getNodeFilePath('transcript', transcript.id), (current) => ({
          ...(current as TranscriptNode),
          canonical_coverage: newCoverage,
        }));
      }

      await setRunLlmTrace(runNodeId, {
        model: llm.model,
        provider: llm.provider,
        progress_status: 'completed',
        progress_tokens: llm.completionTokens,
        duration_ms: llm.durationMs,
        prompt_tokens: llm.promptTokens,
        completion_tokens: llm.completionTokens,
      });

      await appendRunEvent(runNodeId, {
        level: 'success',
        message: `Created ${canonicalIdeas.length} canonical idea${canonicalIdeas.length === 1 ? '' : 's'}`,
        node_ids: canonicalIdeas.map((idea) => idea.id),
      });

      return {
        producedNodeIds: canonicalIdeas.map((idea) => idea.id),
        canonicalIdeaIds: canonicalIdeas.map((idea) => idea.id),
        canonicalIdeas,
        coverageAudit: {
          coverage,
          missed: coverage.filter((item) => item.status === 'missed'),
          warning,
        },
        qualityValidation,
        llmMeta: {
          model: llm.model,
          provider: llm.provider,
          durationMs: llm.durationMs,
          promptTokens: llm.promptTokens,
          completionTokens: llm.completionTokens,
        },
        mode,
        conflict: hasExistingSet,
        existingCanonicalIdeaIds: hasExistingSet ? previousCoverage!.canonical_idea_ids : undefined,
        existingQualityScore: hasExistingSet ? previousCoverage!.quality_score : undefined,
        pendingCoverage: hasExistingSet ? newCoverage : undefined,
      };
    },
    { transcriptId: transcript.id, mode, candidateCount: candidates.length },
  );

  if (record.status === 'failed') {
    throw new ConsolidateTranscriptIdeasError(record.error ?? 'Consolidation failed', 500);
  }

  return { success: true, ...skillResult };
}

export const consolidateTranscriptIdeas = {
  path: '/transcripts/:id/consolidate' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();
    try {
      const result = await consolidateTranscriptIdeasForTranscript({
        transcriptId: id,
        mode: c.req.query('mode'),
        autoRetry: c.req.query('autoRetry') !== 'false',
      });
      return c.json(result);
    } catch (err) {
      if (err instanceof ConsolidateTranscriptIdeasError) {
        return c.json({ success: false, error: err.message }, err.status);
      }
      return c.json(
        { success: false, error: err instanceof Error ? err.message : 'Consolidation failed' },
        500,
      );
    }
  },
};

export const resolveCanonicalIdeaConflict = {
  path: '/transcripts/:id/canonical-ideas/resolve-conflict' as const,
  handler: async (c: AppCtxJson<ResolveCanonicalIdeaConflictBody>) => {
    const { id } = c.req.param() as { id: string };
    const { keep, incomingCanonicalIdeaIds, existingCanonicalIdeaIds, pendingCoverage } = c.req.valid('json');

    const transcriptPath = getNodeFilePath('transcript', id);
    try {
      await readNode(transcriptPath);
    } catch {
      return c.json({ error: 'Transcript not found' }, 404);
    }

    if (keep === 'incoming') {
      if (!pendingCoverage) {
        return c.json({ error: 'pendingCoverage is required when keeping the incoming set.' }, 400);
      }

      for (const ideaId of existingCanonicalIdeaIds) {
        await deleteNode('canonical-idea', ideaId).catch(() => undefined);
      }
      await updateNode(transcriptPath, (current) => ({
        ...(current as TranscriptNode),
        canonical_coverage: pendingCoverage,
      }));

      return c.json({
        success: true,
        kept: 'incoming' as const,
        deletedCount: existingCanonicalIdeaIds.length,
      });
    }

    for (const ideaId of incomingCanonicalIdeaIds) {
      await deleteNode('canonical-idea', ideaId).catch(() => undefined);
    }

    return c.json({
      success: true,
      kept: 'existing' as const,
      deletedCount: incomingCanonicalIdeaIds.length,
    });
  },
};

function parseConsolidateRunTranscriptId(inputSummary: string | undefined): string | undefined {
  if (!inputSummary) return undefined;

  try {
    const parsed = JSON.parse(inputSummary) as { transcriptId?: unknown };
    return typeof parsed.transcriptId === 'string' ? parsed.transcriptId : undefined;
  } catch {
    return undefined;
  }
}

export const cleanCanonicalIdeaArtifacts = {
  path: '/transcripts/:id/canonical-ideas/clean' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();

    const transcriptPath = getNodeFilePath('transcript', id);
    try {
      await readNode(transcriptPath);
    } catch {
      return c.json({ error: 'Transcript not found' }, 404);
    }

    // Delete every canonical-idea node linked to this transcript, including ones orphaned by a
    // never-resolved conflict or by files deleted outside the app — not just the ids currently
    // referenced in canonical_coverage.
    let deletedCanonicalIdeaCount = 0;
    const canonicalIdeaNodes = await listNodes({ type: 'canonical-idea' });
    for (const node of canonicalIdeaNodes) {
      if (node.type !== 'canonical-idea' || node.transcript_id !== id) continue;
      await deleteNode('canonical-idea', node.id).catch(() => undefined);
      deletedCanonicalIdeaCount++;
    }

    // Delete every consolidate-canonical-ideas run for this transcript.
    let deletedRunCount = 0;
    const runNodes = await listNodes({ type: 'run' });
    for (const node of runNodes) {
      if (node.type !== 'run' || (node as RunNode).skill_id !== 'consolidate-canonical-ideas') continue;
      if (parseConsolidateRunTranscriptId((node as RunNode).input_summary) !== id) continue;
      await deleteNode('run', node.id).catch(() => undefined);
      deletedRunCount++;
    }

    await updateNode(transcriptPath, (current) => ({
      ...(current as TranscriptNode),
      canonical_coverage: undefined,
    }));

    return c.json({ success: true, deletedCanonicalIdeaCount, deletedRunCount });
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
