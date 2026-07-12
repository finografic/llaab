import {
  createNode,
  getKnowledgeWikiSectionIds,
  hashKnowledgeWikiPage,
  listKnowledgeWikis,
  readKnowledgeWiki,
  readNodeByType,
} from '@llaab/core';
import { routeLlm } from '@llaab/llm';
import {
  appendDatetimeFilenameSegment,
  toNodeId,
  WikiCompileResultSchema,
  WikiOperationSchema,
} from '@llaab/schemas';
import type { CompileWikiDraftInput, CompileWikiDraftOutput } from './wiki-compile.types.js';
import type { CanonicalIdeaNode, TranscriptNode, WikiCompileResult } from '@llaab/schemas';

import { runSkill } from '../runner.js';
import { buildWikiEvidence } from './wiki-evidence.utils.js';

function parseJson(text: string): unknown {
  const stripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Wiki compiler returned no JSON object.');
  return JSON.parse(stripped.slice(start, end + 1));
}

function buildCompilePrompt(
  transcripts: TranscriptNode[],
  canonicalIdeas: CanonicalIdeaNode[],
  evidence: ReturnType<typeof buildWikiEvidence>,
  suggestedTitle?: string,
  existingWiki?: { id: string; revision: number; body: string; summary: string },
): string {
  return JSON.stringify({
    transcripts: transcripts.map((transcript) => ({
      id: transcript.id,
      title: transcript.title,
      sourceUrl: transcript.source_url,
    })),
    suggestedTitle,
    existingWiki,
    canonicalIdeas: canonicalIdeas.map((idea) => ({
      id: idea.id,
      title: idea.title,
      body: idea.body,
      keyClaims: idea.key_claims,
      tags: idea.tags,
    })),
    evidence,
  });
}

const SYSTEM_PROMPT = `Compile selected canonical ideas into a source-backed wiki draft.
Return only JSON with operation, topic, summary, sections, links, source_refs, coverage,
change_summary, unresolved_questions, and contested_claims. Use only supplied ids and URLs.
Every substantive section needs source_ref_ids and source_canonical_idea_ids. Do not create links
unless a target wiki id is supplied. Use create for a new topic; use update, no-op, or needs-review
for a target wiki. Preserve unrelated existing sections byte-for-byte.`;

function validateResult(
  result: WikiCompileResult,
  canonicalIdeaIds: Set<string>,
  sourceRefIds: Set<string>,
  allowedLinkTargetIds?: Set<string>,
): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  for (const sourceRef of result.source_refs) {
    if (!sourceRefIds.has(sourceRef.id)) {
      throw new Error(`Wiki output introduced unknown source ref: ${sourceRef.id}`);
    }
  }
  for (const link of result.links) {
    if (!allowedLinkTargetIds?.has(link.target_wiki_id)) {
      throw new Error(`Wiki output introduced an unavailable link target: ${link.target_wiki_id}`);
    }
  }
  for (const section of result.sections) {
    if (section.body.trim() && section.source_ref_ids.length === 0) {
      throw new Error(`Wiki section "${section.id}" has no source references.`);
    }
    for (const id of section.source_ref_ids) {
      if (!sourceRefIds.has(id)) throw new Error(`Wiki section references unknown source ref: ${id}`);
    }
    for (const id of section.source_canonical_idea_ids) {
      if (!canonicalIdeaIds.has(id)) throw new Error(`Wiki section references unknown canonical idea: ${id}`);
    }
  }
  for (const id of result.coverage.represented_canonical_idea_ids) {
    if (!canonicalIdeaIds.has(id)) throw new Error(`Wiki coverage references unknown canonical idea: ${id}`);
  }
  if (result.coverage.represented_canonical_idea_ids.length < canonicalIdeaIds.size) {
    warnings.push('Some selected canonical ideas were omitted from the proposed wiki.');
  }
  if (result.sections.length === 0 && result.operation === 'create') {
    throw new Error('Wiki create draft has no sections.');
  }
  return { score: warnings.length === 0 ? 100 : 75, warnings };
}

function normalizedTopic(value: string): string {
  return toNodeId(value);
}

export async function compileWikiDraft(input: CompileWikiDraftInput) {
  return runSkill<CompileWikiDraftInput, CompileWikiDraftOutput>(
    'compile-wiki-draft',
    async (_, runNodeId) => {
      if (input.canonicalIdeaIds.length === 0) throw new Error('Select at least one canonical idea.');
      if (new Set(input.canonicalIdeaIds).size !== input.canonicalIdeaIds.length) {
        throw new Error('Canonical idea selection contains duplicates.');
      }
      const entryTranscript = await readNodeByType('transcript', input.transcriptId);
      const canonicalIdeas = await Promise.all(
        input.canonicalIdeaIds.map((id) => readNodeByType('canonical-idea', id)),
      );
      const transcriptIds = [...new Set(canonicalIdeas.map((idea) => idea.transcript_id))];
      const transcripts = await Promise.all(
        transcriptIds.map((id) =>
          id === entryTranscript.id ? Promise.resolve(entryTranscript) : readNodeByType('transcript', id),
        ),
      );
      const transcriptById = new Map(transcripts.map((transcript) => [transcript.id, transcript]));
      const evidence = transcripts.flatMap((transcript) =>
        buildWikiEvidence(
          transcript,
          canonicalIdeas.filter((idea) => idea.transcript_id === transcript.id),
        ),
      );
      const sourceRefs = evidence.map((item) => ({
        id: item.id,
        kind: 'transcript' as const,
        node_id: item.transcript_id,
        title: transcriptById.get(item.transcript_id)?.title,
        url: item.source_url,
        ...(item.locator ? { locator: item.locator } : {}),
        verification: 'source-backed' as const,
      }));
      const existingWiki = input.targetWikiId ? await readKnowledgeWiki(input.targetWikiId) : undefined;
      const promotedWikis = await listKnowledgeWikis().catch(() => []);
      const topicKey =
        existingWiki?.topic_key ??
        toNodeId(input.suggestedTitle ?? canonicalIdeas[0]?.title ?? entryTranscript.title);
      const prompt = buildCompilePrompt(
        transcripts,
        canonicalIdeas,
        evidence,
        input.suggestedTitle,
        existingWiki && {
          id: existingWiki.id,
          revision: existingWiki.revision,
          body: existingWiki.body,
          summary: existingWiki.summary,
        },
      );

      let llm = await routeLlm('wiki-compile', prompt, { system: SYSTEM_PROMPT, bypassCache: true });
      let result = WikiCompileResultSchema.parse(parseJson(llm.text));
      let quality = validateResult(
        result,
        new Set(canonicalIdeas.map((idea) => idea.id)),
        new Set(sourceRefs.map((sourceRef) => sourceRef.id)),
        existingWiki
          ? new Set(promotedWikis.filter((wiki) => wiki.id !== existingWiki.id).map((wiki) => wiki.id))
          : undefined,
      );
      if (quality.score < 80) {
        llm = await routeLlm('wiki-compile', prompt, {
          system: `${SYSTEM_PROMPT}\nFix: ${quality.warnings.join(' ')}`,
          bypassCache: true,
        });
        result = WikiCompileResultSchema.parse(parseJson(llm.text));
        quality = validateResult(
          result,
          new Set(canonicalIdeas.map((idea) => idea.id)),
          new Set(sourceRefs.map((ref) => ref.id)),
          existingWiki
            ? new Set(promotedWikis.filter((wiki) => wiki.id !== existingWiki.id).map((wiki) => wiki.id))
            : undefined,
        );
      }

      let operation = WikiOperationSchema.parse(result.operation);
      const duplicateTopic = !existingWiki
        ? promotedWikis.find(
            (wiki) =>
              wiki.topic_key === result.topic.topic_key ||
              normalizedTopic(wiki.title) === normalizedTopic(result.topic.title) ||
              wiki.aliases.some((alias) => normalizedTopic(alias) === normalizedTopic(result.topic.title)),
          )
        : undefined;
      if (duplicateTopic && operation === 'create') operation = 'needs-review';
      if (existingWiki && operation === 'create') {
        throw new Error('An existing wiki target cannot produce a create draft.');
      }
      if (!existingWiki && operation === 'update') {
        throw new Error('An update draft requires an existing promoted wiki target.');
      }
      if (existingWiki && result.topic.topic_key !== existingWiki.topic_key) {
        throw new Error('An update draft cannot change the promoted wiki topic key.');
      }
      const draftId = appendDatetimeFilenameSegment(`${topicKey}-wiki-draft`, new Date());
      const body = result.sections
        .map((section) => {
          const citations = section.source_ref_ids.map((id) => `[^${id}]`).join(' ');
          return `<!-- wiki-section:${section.id} -->\n\n## ${section.heading}\n\n${section.body}${citations ? ` ${citations}` : ''}`;
        })
        .join('\n\n');
      const existingSectionIds = new Set(existingWiki ? getKnowledgeWikiSectionIds(existingWiki.body) : []);
      const patch = existingWiki
        ? result.sections.map((section) => ({
            section_id: section.id,
            operation: existingSectionIds.has(section.id) ? ('update' as const) : ('add' as const),
            after: section.body,
          }))
        : [];
      const created = await createNode({
        type: 'wiki-draft',
        id: draftId,
        title: result.topic.title,
        body,
        tags: canonicalIdeas[0]?.tags.filter((tag) => tag.startsWith('d:')) ?? [],
        extra: {
          topic_key: result.topic.topic_key || topicKey,
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
          source_ids: [
            ...new Set(
              transcripts.flatMap((transcript) => (transcript.source_id ? [transcript.source_id] : [])),
            ),
          ],
          source_refs: sourceRefs,
          represented_canonical_idea_ids: result.coverage.represented_canonical_idea_ids,
          omitted_canonical_idea_ids: result.coverage.omitted_canonical_ideas.map((item) => item.id),
          sections: result.sections,
          patch,
          proposed_links: result.links,
          quality_score: quality.score,
          warning: quality.warnings.join(' ') || undefined,
          ...(duplicateTopic
            ? {
                warning:
                  `Possible duplicate of promoted wiki ${duplicateTopic.id}. ${quality.warnings.join(' ')}`.trim(),
              }
            : {}),
          change_summary: result.change_summary,
          unresolved_questions: result.unresolved_questions,
          contested_claims: result.contested_claims,
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
        warnings: quality.warnings,
        producedNodeIds: [created.id],
        evidence,
        runTrace: {
          stages: [
            { name: 'resolve-sources', status: 'completed', output: { transcriptCount: transcripts.length } },
            { name: 'expand-evidence', status: 'completed', output: { evidenceCount: evidence.length } },
            { name: 'resolve-topic', status: 'completed', output: { topicKey, operation } },
            { name: 'compile', status: 'completed', output: { operation } },
            { name: 'validate', status: 'completed', output: { qualityScore: quality.score } },
            { name: 'retry', status: 'completed', output: { attempted: quality.score < 80 } },
            { name: 'render', status: 'completed', output: { sectionCount: result.sections.length } },
            { name: 'write-draft', status: 'completed', output: { draftId: created.id } },
          ],
          decisions: [{ type: 'accept', reason: 'Wiki draft passed deterministic validation.' }],
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
