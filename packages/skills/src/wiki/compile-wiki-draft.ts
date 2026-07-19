import { randomUUID } from 'node:crypto';
import {
  analyzeKnowledgeWikiNovelty,
  createNode,
  hashKnowledgeWikiPage,
  listKnowledgeWikis,
  readKnowledgeWiki,
  resolveKnowledgeWikiTopic,
} from '@llaab/core';
import { routeLlm } from '@llaab/llm';
import {
  appendDatetimeFilenameSegment,
  NodeIdSchema,
  toNodeId,
  WikiCompileResultSchema,
  WikiOperationSchema,
  WikiTagSchema,
} from '@llaab/schemas';
import type { CompileWikiDraftInput, CompileWikiDraftOutput } from './wiki-compile.types.js';
import type { KnowledgeWikiPage, WikiCompileResult, WikiSourceRef } from '@llaab/schemas';

import { runSkill } from '../runner.js';
import {
  buildWikiCompilePrompt,
  parseWikiCompileJson,
  WIKI_COMPILE_SYSTEM_PROMPT,
} from './wiki-compile-prompt.utils.js';
import {
  buildWikiSectionPatch,
  buildWikiResultingBody,
  renderWikiDraftBody,
  validateWikiCompileResult,
} from './wiki-compile-validation.utils.js';
import { buildWikiEvidence } from './wiki-evidence.utils.js';
import { resolveWikiSourceSelection } from './wiki-source-selection.service.js';

interface CompileAttempt {
  result: WikiCompileResult;
  llm: Awaited<ReturnType<typeof routeLlm>>;
  quality: ReturnType<typeof validateWikiCompileResult>;
}

const QUALITY_RETRY_THRESHOLD = 80;
const MAX_RELATED_WIKIS = 8;

function selectRelatedWikis(
  wikis: KnowledgeWikiPage[],
  target: KnowledgeWikiPage | undefined,
  tags: string[],
): KnowledgeWikiPage[] {
  const selectedTags = new Set(tags);
  return wikis
    .filter((wiki) => wiki.id !== target?.id)
    .map((wiki) => ({ wiki, shared: wiki.tags.filter((tag) => selectedTags.has(tag)).length }))
    .filter(({ shared }) => shared > 0)
    .sort((left, right) => right.shared - left.shared || left.wiki.id.localeCompare(right.wiki.id))
    .map(({ wiki }) => wiki)
    .slice(0, MAX_RELATED_WIKIS);
}

function selectedWikiTags(canonicalIdeas: KnowledgeWikiPage[] | Array<{ tags: string[] }>): string[] {
  return [...new Set(canonicalIdeas.flatMap((idea) => idea.tags))].filter(
    (tag) => WikiTagSchema.safeParse(tag).success,
  );
}

function buildSourceRefs(
  evidence: ReturnType<typeof buildWikiEvidence>,
  existingWiki: KnowledgeWikiPage | undefined,
): WikiSourceRef[] {
  const refs: WikiSourceRef[] = evidence.map((item) => ({
    id: item.id,
    kind: 'transcript',
    node_id: item.transcript_id,
    title: item.title,
    url: item.source_url,
    locator: item.locator,
    excerpt: item.excerpt,
    verification: 'source-backed',
    validation_notes: item.locator
      ? []
      : ['No reliable paragraph or timestamp locator was available; citation is transcript-level.'],
  }));
  return [...(existingWiki?.source_refs ?? []), ...refs].filter(
    (ref, index, all) => all.findIndex((candidate) => candidate.id === ref.id) === index,
  );
}

async function compileAttempt(input: {
  prompt: string;
  system: string;
  canonicalIdeaIds: Set<string>;
  sourceRefs: WikiSourceRef[];
  allowedSourceRefs: Map<string, { node_id?: string; url?: string; locator?: string }>;
  allowedLinkTargetIds: Set<string>;
  expectedTopicKey?: string;
  hasExistingWiki: boolean;
  sourceCount: number;
}): Promise<CompileAttempt> {
  const llm = await routeLlm('wiki-compile', input.prompt, {
    system: input.system,
    bypassCache: true,
  });
  const result = reconcileWikiSourceRefs(
    WikiCompileResultSchema.parse(
      normalizeWikiCompileJson(parseWikiCompileJson(llm.text), input.canonicalIdeaIds, input.sourceRefs),
    ),
    input.sourceRefs,
  );
  reconcileWikiCoverage(result, input.canonicalIdeaIds);
  const quality = validateWikiCompileResult({
    result,
    canonicalIdeaIds: input.canonicalIdeaIds,
    allowedSourceRefs: input.allowedSourceRefs,
    allowedLinkTargetIds: input.allowedLinkTargetIds,
    expectedTopicKey: input.expectedTopicKey,
    hasExistingWiki: input.hasExistingWiki,
    sourceCount: input.sourceCount,
  });
  return { result, llm, quality };
}

function normalizeModelNodeId(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return NodeIdSchema.safeParse(value).success ? value : toNodeId(value);
}

const WIKI_LINK_RELATIONS = new Set([
  'related-to',
  'depends-on',
  'extends',
  'contrasts-with',
  'example-of',
  'supports',
  'supersedes',
]);

function normalizeWikiLinkRelation(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase().replace(/[ _]+/g, '-');
  if (WIKI_LINK_RELATIONS.has(normalized)) return normalized;
  const aliases: Record<string, string> = {
    'related': 'related-to',
    'relates-to': 'related-to',
    'dependency': 'depends-on',
    'depends': 'depends-on',
    'contrast': 'contrasts-with',
    'contrasts': 'contrasts-with',
    'example': 'example-of',
    'supports': 'supports',
    'support': 'supports',
    'supersedes': 'supersedes',
    'extends': 'extends',
  };
  return aliases[normalized];
}

function deriveModelSummary(draft: {
  topic?: { title?: unknown };
  sections?: Array<{ body?: unknown; heading?: unknown }>;
}): string {
  const firstSection = draft.sections?.find(
    (section) => typeof section.body === 'string' && section.body.trim(),
  );
  if (firstSection && typeof firstSection.body === 'string') {
    return firstSection.body.trim().replace(/\s+/g, ' ').slice(0, 240);
  }
  const firstHeading = draft.sections?.find(
    (section) => typeof section.heading === 'string' && section.heading.trim(),
  );
  if (firstHeading && typeof firstHeading.heading === 'string') return firstHeading.heading.trim();
  return typeof draft.topic?.title === 'string' && draft.topic.title.trim()
    ? draft.topic.title.trim()
    : 'Generated wiki draft.';
}

function reconcileWikiSourceRefs(result: WikiCompileResult, sourceRefs: WikiSourceRef[]): WikiCompileResult {
  const allowedIds = new Set(sourceRefs.map((sourceRef) => sourceRef.id));
  const fallbackSourceRefId = sourceRefs[0]?.id;
  const replacementByModelId = new Map<string, string>();

  result.source_refs.forEach((sourceRef, index) => {
    if (allowedIds.has(sourceRef.id)) return;
    const replacement = sourceRefs[index]?.id ?? fallbackSourceRefId;
    if (replacement) replacementByModelId.set(sourceRef.id, replacement);
  });

  result.source_refs = sourceRefs;
  result.sections = result.sections.map((section) => {
    const sourceRefIds = section.source_ref_ids
      .map((id) => replacementByModelId.get(id) ?? id)
      .filter((id) => allowedIds.has(id));
    return {
      ...section,
      source_ref_ids:
        sourceRefIds.length > 0 || !section.body.trim() || !fallbackSourceRefId
          ? sourceRefIds
          : [fallbackSourceRefId],
    };
  });

  return result;
}

function reconcileWikiCoverage(result: WikiCompileResult, canonicalIdeaIds: Set<string>): void {
  const represented = new Set(result.coverage.represented_canonical_idea_ids);
  const omitted = new Set(result.coverage.omitted_canonical_ideas.map((idea) => idea.id));
  for (const canonicalIdeaId of canonicalIdeaIds) {
    if (represented.has(canonicalIdeaId) || omitted.has(canonicalIdeaId)) continue;
    result.coverage.omitted_canonical_ideas.push({
      id: canonicalIdeaId,
      reason: 'The model output did not explicitly account for this selected canonical idea.',
    });
  }
}

function normalizeWikiCompileJson(
  value: unknown,
  canonicalIdeaIds: Set<string>,
  sourceRefs: WikiSourceRef[],
): unknown {
  if (!value || typeof value !== 'object' || !('topic' in value)) return value;
  const draft = value as {
    topic?: { topic_key?: unknown; title?: unknown };
    summary?: unknown;
    sections?: Array<{
      id?: unknown;
      heading?: unknown;
      title?: unknown;
      name?: unknown;
      body?: unknown;
      content?: unknown;
      text?: unknown;
      source_ref_ids?: unknown;
      source_refs?: unknown;
      source_canonical_idea_ids?: unknown;
      canonical_idea_ids?: unknown;
    }>;
    links?: Array<{
      target_wiki_id?: unknown;
      target_id?: unknown;
      wiki_id?: unknown;
      target?: unknown;
      relation?: unknown;
    }>;
    source_refs?: Array<{ id?: unknown; node_id?: unknown }>;
    coverage?: unknown;
    change_summary?: unknown;
  };
  if (draft.topic && typeof draft.topic === 'object') {
    if (typeof draft.topic.topic_key === 'string') {
      draft.topic.topic_key = normalizeModelNodeId(draft.topic.topic_key);
    } else if (typeof draft.topic.title === 'string') {
      draft.topic.topic_key = toNodeId(draft.topic.title);
    }
  }
  if (Array.isArray(draft.sections)) {
    const sectionIds = new Set<string>();
    for (const [index, section] of draft.sections.entries()) {
      if (!section || typeof section !== 'object') continue;
      const headingCandidate = [section.heading, section.title, section.name, section.id].find(
        (candidate): candidate is string => typeof candidate === 'string' && Boolean(candidate.trim()),
      );
      section.heading = headingCandidate?.trim() ?? `Section ${index + 1}`;
      const bodyCandidate = [section.body, section.content, section.text].find(
        (candidate): candidate is string => typeof candidate === 'string',
      );
      section.body = bodyCandidate ?? '';
      const normalizedId = normalizeModelNodeId(section.id ?? section.heading);
      const baseId = typeof normalizedId === 'string' ? normalizedId : `section-${index + 1}`;
      section.id = sectionIds.has(baseId) ? toNodeId(`${baseId}-${index + 1}`) : baseId;
      sectionIds.add(section.id as string);
      section.source_ref_ids ??= section.source_refs;
      section.source_canonical_idea_ids ??= section.canonical_idea_ids;
      if (Array.isArray(section.source_ref_ids)) {
        section.source_ref_ids = section.source_ref_ids.map(normalizeModelNodeId);
      }
      if (Array.isArray(section.source_canonical_idea_ids)) {
        section.source_canonical_idea_ids = section.source_canonical_idea_ids.map(normalizeModelNodeId);
      }
    }
  }
  if (Array.isArray(draft.links)) {
    draft.links = draft.links.flatMap((link) => {
      if (!link || typeof link !== 'object') return [];
      const targetWikiId = normalizeModelNodeId(
        link.target_wiki_id ?? link.target_id ?? link.wiki_id ?? link.target,
      );
      const relation = normalizeWikiLinkRelation(link.relation);
      if (typeof targetWikiId !== 'string' || !relation) return [];
      return [{ ...link, target_wiki_id: targetWikiId, relation }];
    });
  }
  // Reference metadata is deterministic evidence, not model-authored content. Replacing it here
  // also accepts model shorthand such as a top-level array of reference ids.
  draft.source_refs = sourceRefs;
  const sectionCanonicalIdeaIds =
    draft.sections
      ?.flatMap((section) =>
        Array.isArray(section.source_canonical_idea_ids) ? section.source_canonical_idea_ids : [],
      )
      .filter((id): id is string => typeof id === 'string' && canonicalIdeaIds.has(id)) ?? [];
  if (!draft.coverage || typeof draft.coverage !== 'object' || Array.isArray(draft.coverage)) {
    draft.coverage = {
      represented_canonical_idea_ids: sectionCanonicalIdeaIds,
      omitted_canonical_ideas: [],
    };
  }
  if (draft.coverage && typeof draft.coverage === 'object') {
    const coverage = draft.coverage as {
      represented_canonical_idea_ids?: unknown;
      omitted_canonical_ideas?: unknown;
    };
    const representedCanonicalIdeaIds = new Set([
      ...sectionCanonicalIdeaIds,
      ...(Array.isArray(coverage.represented_canonical_idea_ids)
        ? coverage.represented_canonical_idea_ids
            .map(normalizeModelNodeId)
            .filter((id): id is string => typeof id === 'string' && canonicalIdeaIds.has(id))
        : []),
    ]);
    const remainingCanonicalIdeaIds = new Set(
      [...canonicalIdeaIds].filter((id) => !representedCanonicalIdeaIds.has(id)),
    );
    const omittedCanonicalIdeas = Array.isArray(coverage.omitted_canonical_ideas)
      ? coverage.omitted_canonical_ideas.flatMap((omitted) => {
          if (typeof omitted === 'string') {
            const normalizedId = normalizeModelNodeId(omitted);
            const id =
              typeof normalizedId === 'string' && remainingCanonicalIdeaIds.has(normalizedId)
                ? normalizedId
                : remainingCanonicalIdeaIds.values().next().value;
            if (!id) return [];
            remainingCanonicalIdeaIds.delete(id);
            return [
              {
                id,
                reason:
                  id === normalizedId ? 'The model marked this selected canonical idea as omitted.' : omitted,
              },
            ];
          }
          if (!omitted || typeof omitted !== 'object') return [];
          const item = omitted as { id?: unknown; reason?: unknown };
          const normalizedId = normalizeModelNodeId(item.id);
          if (typeof normalizedId !== 'string' || !remainingCanonicalIdeaIds.has(normalizedId)) {
            return [];
          }
          remainingCanonicalIdeaIds.delete(normalizedId);
          return [
            {
              id: normalizedId,
              reason:
                typeof item.reason === 'string' && item.reason.trim()
                  ? item.reason.trim()
                  : 'The model marked this selected canonical idea as omitted.',
            },
          ];
        })
      : [];
    coverage.represented_canonical_idea_ids = [...representedCanonicalIdeaIds];
    coverage.omitted_canonical_ideas = omittedCanonicalIdeas;
  }
  if (typeof draft.summary !== 'string' || !draft.summary.trim()) {
    draft.summary = deriveModelSummary(draft);
  }
  if (typeof draft.change_summary !== 'string' || !draft.change_summary.trim()) {
    draft.change_summary = 'Compiled wiki draft from selected canonical ideas.';
  }
  return draft;
}

export async function compileWikiDraft(input: CompileWikiDraftInput) {
  return runSkill<CompileWikiDraftInput, CompileWikiDraftOutput>(
    'compile-wiki-draft',
    async (_, runNodeId) => {
      const selection = await resolveWikiSourceSelection(input);
      const { entryTranscript, canonicalIdeas, transcripts } = selection;
      const transcriptIds = [...new Set(canonicalIdeas.map((idea) => idea.transcript_id))];
      const sourceIds = [...new Set(transcripts.flatMap((transcript) => transcript.source_id ?? []))];
      const promotedWikis = await listKnowledgeWikis();
      const existingWiki = input.targetWikiId ? await readKnowledgeWiki(input.targetWikiId) : undefined;
      const suggestedTopicKey = input.suggestedTopicKey
        ? NodeIdSchema.parse(input.suggestedTopicKey)
        : toNodeId(input.suggestedTitle ?? canonicalIdeas[0]?.title ?? entryTranscript.title);
      const topicKey = existingWiki?.topic_key ?? suggestedTopicKey;
      const topicResolution = existingWiki
        ? { operation: 'update' as const, matches: [] }
        : resolveKnowledgeWikiTopic(promotedWikis, {
            topicKey,
            title: input.suggestedTitle ?? canonicalIdeas[0]!.title,
            canonicalIdeaIds: canonicalIdeas.map((idea) => idea.id),
            tags: canonicalIdeas.flatMap((idea) => idea.tags),
          });
      const representedWiki = existingWiki
        ? undefined
        : promotedWikis.find((wiki) =>
            canonicalIdeas.every((idea) => wiki.source_canonical_idea_ids.includes(idea.id)),
          );
      const preResolvedOperation = existingWiki
        ? ('update' as const)
        : representedWiki
          ? ('no-op' as const)
          : topicResolution.operation;
      const relatedWikis = selectRelatedWikis(
        promotedWikis,
        existingWiki,
        canonicalIdeas.flatMap((idea) => idea.tags),
      );
      const evidence = transcripts.flatMap((transcript) =>
        buildWikiEvidence(
          transcript,
          canonicalIdeas.filter((idea) => idea.transcript_id === transcript.id),
          selection.candidateTitlesByCanonicalId,
        ),
      );
      if (evidence.length === 0) throw new Error('Selected canonical ideas produced no bounded evidence.');
      const sourceRefs = buildSourceRefs(evidence, existingWiki);
      const prompt = buildWikiCompilePrompt({
        transcripts,
        canonicalIdeas,
        evidence,
        suggestedTitle: input.suggestedTitle,
        suggestedTopicKey: topicKey,
        existingWiki,
        relatedWikis,
        preResolvedOperation,
      });
      const validationInput = {
        prompt,
        canonicalIdeaIds: new Set(canonicalIdeas.map((idea) => idea.id)),
        sourceRefs,
        allowedSourceRefs: new Map(sourceRefs.map((ref) => [ref.id, ref])),
        allowedLinkTargetIds: new Set(
          promotedWikis.filter((wiki) => wiki.id !== existingWiki?.id).map((wiki) => wiki.id),
        ),
        expectedTopicKey: existingWiki?.topic_key ?? input.suggestedTopicKey,
        hasExistingWiki: existingWiki !== undefined,
        sourceCount: Math.max(sourceIds.length, transcriptIds.length),
      };

      let retryAttempted = false;
      let firstFailure: string | undefined;
      let attempt: CompileAttempt | undefined;
      try {
        attempt = await compileAttempt({
          ...validationInput,
          system: WIKI_COMPILE_SYSTEM_PROMPT,
        });
      } catch (error) {
        firstFailure = error instanceof Error ? error.message : String(error);
      }
      if (!attempt || attempt.quality.score < QUALITY_RETRY_THRESHOLD) {
        retryAttempted = true;
        firstFailure ??= attempt?.quality.warnings.join(' ') || 'Quality score was below threshold.';
        attempt = await compileAttempt({
          ...validationInput,
          system: `${WIKI_COMPILE_SYSTEM_PROMPT}\nFix invalid output or validation issues: ${firstFailure}`,
        });
      }

      const { result, llm, quality } = attempt;
      let operation = WikiOperationSchema.parse(result.operation);
      if (existingWiki && input.forceUpdate) operation = 'update';
      const novelty =
        existingWiki && !input.forceUpdate
          ? analyzeKnowledgeWikiNovelty(
              existingWiki,
              canonicalIdeas.map((idea) => ({
                id: idea.id,
                body: idea.body,
                keyClaims: idea.key_claims,
              })),
              Math.max(sourceIds.length, transcriptIds.length),
            )
          : undefined;
      if (!existingWiki && topicResolution.operation !== 'create') operation = 'needs-review';
      if (representedWiki) {
        operation = 'no-op';
        const message = `Selected canonical evidence is already represented by ${representedWiki.id}.`;
        quality.issues.push({ code: 'already-represented', message });
        quality.warnings.push(message);
        quality.score = Math.max(0, quality.score - 5);
      }
      if (novelty) {
        operation = novelty.recommended_operation;
        if (result.operation === 'needs-review') operation = 'needs-review';
      }
      if (novelty && !novelty.has_novel_evidence) {
        quality.warnings.push(novelty.reason);
        quality.issues.push({ code: 'low-novelty', message: novelty.reason });
        quality.score = Math.max(0, quality.score - 10);
      }
      const selectedDomains = new Set(
        canonicalIdeas.flatMap((idea) => idea.tags.filter((tag) => tag.startsWith('d:'))),
      );
      if (selectedDomains.size > 1) {
        const message = 'Selected ideas span multiple domain categories and require merge review.';
        quality.issues.push({ code: 'unrelated-category-merge', message });
        quality.warnings.push(message);
        quality.score = Math.max(0, quality.score - 10);
      }
      if (result.links.some((link) => !link.note)) {
        const message = 'One or more proposed links lack an evidence note.';
        quality.issues.push({ code: 'weak-link', message });
        quality.warnings.push(message);
        quality.score = Math.max(0, quality.score - 5);
      }
      const body = renderWikiDraftBody(result);
      const patch = buildWikiSectionPatch(existingWiki, result, operation);
      const resultingBody = buildWikiResultingBody(existingWiki?.body, body, patch);
      const draftId = `${appendDatetimeFilenameSegment(`${topicKey}-wiki-draft`, new Date())}-${randomUUID().slice(0, 8)}`;
      const topicWarning = topicResolution.matches.length
        ? `Possible topic overlap with ${topicResolution.matches.map((match) => match.wiki_id).join(', ')}.`
        : undefined;
      if (topicWarning) {
        quality.issues.push({ code: 'duplicate-topic-risk', message: topicWarning });
        quality.score = Math.max(0, quality.score - 10);
      }
      const contestedClaims = [...new Set([...(novelty?.contradictions ?? []), ...result.contested_claims])];
      const contestedClaimEvidence = contestedClaims.map((claim) => ({
        claim,
        existing_source_ref_ids: existingWiki?.source_refs.map((ref) => ref.id) ?? [],
        incoming_source_ref_ids: evidence.map((item) => item.id),
      }));
      const created = await createNode({
        type: 'wiki-draft',
        id: draftId,
        title: result.topic.title,
        body,
        tags: selectedWikiTags(canonicalIdeas),
        extra: {
          topic_key: result.topic.topic_key || topicKey,
          entry_path: input.entryPath,
          ...(existingWiki
            ? {
                target_wiki_id: existingWiki.id,
                base_revision: existingWiki.revision,
                base_content_hash: hashKnowledgeWikiPage(existingWiki),
              }
            : {}),
          operation,
          source_canonical_idea_ids: canonicalIdeas.map((idea) => idea.id),
          source_transcript_ids: transcriptIds,
          source_ids: sourceIds,
          selected_canonical_idea_count: canonicalIdeas.length,
          selected_transcript_count: transcriptIds.length,
          selected_source_count: sourceIds.length,
          source_refs: sourceRefs,
          represented_canonical_idea_ids: result.coverage.represented_canonical_idea_ids,
          omitted_canonical_idea_ids: result.coverage.omitted_canonical_ideas.map((item) => item.id),
          omitted_canonical_ideas: result.coverage.omitted_canonical_ideas,
          sections: result.sections,
          patch,
          resulting_body: resultingBody,
          unchanged_section_ids: patch
            .filter((item) => item.operation === 'unchanged')
            .map((item) => item.section_id),
          proposed_links: result.links,
          quality_score: quality.score,
          validation_issues: quality.issues,
          novelty_reason: novelty?.reason,
          novelty_analysis: novelty,
          warning: [topicWarning, ...quality.warnings].filter(Boolean).join(' ') || undefined,
          change_summary: result.change_summary,
          unresolved_questions: result.unresolved_questions,
          contested_claims: contestedClaims,
          contested_claim_evidence: contestedClaimEvidence,
          topic_matches: topicResolution.matches,
          run_id: runNodeId,
          llm_model: llm.model,
          llm_provider: llm.provider,
          llm_duration_ms: llm.durationMs,
          llm_prompt_tokens: llm.promptTokens,
          llm_completion_tokens: llm.completionTokens,
        },
      });

      return {
        draftId: created.id,
        operation,
        qualityScore: quality.score,
        warnings: [topicWarning, ...quality.warnings].filter((value): value is string => Boolean(value)),
        selectedCanonicalIdeaCount: canonicalIdeas.length,
        selectedTranscriptCount: transcriptIds.length,
        selectedSourceCount: sourceIds.length,
        producedNodeIds: [created.id],
        evidence,
        runTrace: {
          stages: [
            { name: 'resolve-sources', status: 'completed', output: { transcriptCount: transcripts.length } },
            { name: 'expand-evidence', status: 'completed', output: { evidenceCount: evidence.length } },
            { name: 'resolve-topic', status: 'completed', output: { topicKey, operation } },
            { name: 'compile', status: 'completed', output: { attempts: retryAttempted ? 2 : 1 } },
            { name: 'validate', status: 'completed', output: { qualityScore: quality.score } },
            { name: 'retry', status: 'completed', output: { attempted: retryAttempted, firstFailure } },
            { name: 'render', status: 'completed', output: { sectionCount: result.sections.length } },
            { name: 'write-draft', status: 'completed', output: { draftId: created.id } },
          ],
          decisions: [
            ...(retryAttempted
              ? [{ type: 'retry' as const, reason: firstFailure ?? 'Quality score required one retry.' }]
              : []),
            { type: 'accept', reason: 'Wiki draft passed deterministic validation.' },
          ],
          llm: {
            model: llm.model,
            provider: llm.provider,
            duration_ms: llm.durationMs,
            prompt_tokens: llm.promptTokens,
            completion_tokens: llm.completionTokens,
            parsed: true,
          },
        },
      };
    },
    input,
  );
}
