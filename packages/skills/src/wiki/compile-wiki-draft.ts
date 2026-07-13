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
  const domains = new Set(tags.filter((tag) => tag.startsWith('d:')));
  return wikis
    .filter((wiki) => wiki.id !== target?.id)
    .filter((wiki) => wiki.tags.some((tag) => domains.has(tag)))
    .slice(0, MAX_RELATED_WIKIS);
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
  const result = WikiCompileResultSchema.parse(parseWikiCompileJson(llm.text));
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
        allowedSourceRefs: new Map(sourceRefs.map((ref) => [ref.id, ref])),
        allowedLinkTargetIds: new Set(
          promotedWikis.filter((wiki) => wiki.id !== existingWiki?.id).map((wiki) => wiki.id),
        ),
        expectedTopicKey: topicKey,
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
      const novelty = existingWiki
        ? analyzeKnowledgeWikiNovelty(
            existingWiki,
            canonicalIdeas.map((idea) => idea.id),
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
      if (novelty && !novelty.hasNovelEvidence) {
        operation = 'no-op';
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
      const draftId = appendDatetimeFilenameSegment(`${topicKey}-wiki-draft`, new Date());
      const topicWarning = topicResolution.matches.length
        ? `Possible topic overlap with ${topicResolution.matches.map((match) => match.wiki_id).join(', ')}.`
        : undefined;
      if (topicWarning) {
        quality.issues.push({ code: 'duplicate-topic-risk', message: topicWarning });
        quality.score = Math.max(0, quality.score - 10);
      }
      const created = await createNode({
        type: 'wiki-draft',
        id: draftId,
        title: result.topic.title,
        body,
        tags: [...new Set(canonicalIdeas.flatMap((idea) => idea.tags.filter((tag) => tag.startsWith('d:'))))],
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
          warning: [topicWarning, ...quality.warnings].filter(Boolean).join(' ') || undefined,
          change_summary: result.change_summary,
          unresolved_questions: result.unresolved_questions,
          contested_claims: result.contested_claims,
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
