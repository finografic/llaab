import { createNode, readNodeByType } from '@llaab/core';
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
  transcript: TranscriptNode,
  canonicalIdeas: CanonicalIdeaNode[],
  evidence: ReturnType<typeof buildWikiEvidence>,
  suggestedTitle?: string,
): string {
  return JSON.stringify({
    transcript: { id: transcript.id, title: transcript.title, sourceUrl: transcript.source_url },
    suggestedTitle,
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

const SYSTEM_PROMPT = `Compile selected canonical ideas into a source-backed seed wiki draft.
Return only JSON with operation, topic, summary, sections, links, source_refs, coverage,
change_summary, unresolved_questions, and contested_claims. Use only supplied ids and URLs.
Every substantive section needs source_ref_ids and source_canonical_idea_ids. Do not create links
unless a target wiki id is supplied. Use operation create, no-op, or needs-review; never update.`;

function validateResult(
  result: WikiCompileResult,
  canonicalIdeaIds: Set<string>,
  sourceRefIds: Set<string>,
): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  for (const sourceRef of result.source_refs) {
    if (!sourceRefIds.has(sourceRef.id)) {
      throw new Error(`Wiki output introduced unknown source ref: ${sourceRef.id}`);
    }
  }
  if (result.links.length > 0) {
    throw new Error('Wiki create drafts cannot introduce links before promoted wikis exist.');
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
  if (result.sections.length === 0 && result.operation === 'create')
    {throw new Error('Wiki create draft has no sections.');}
  return { score: warnings.length === 0 ? 100 : 75, warnings };
}

export async function compileWikiDraft(input: CompileWikiDraftInput) {
  return runSkill<CompileWikiDraftInput, CompileWikiDraftOutput>(
    'compile-wiki-draft',
    async (_, runNodeId) => {
      if (input.targetWikiId) throw new Error('Updating an existing wiki is not available in Phase 1.');
      if (input.canonicalIdeaIds.length === 0) throw new Error('Select at least one canonical idea.');
      if (new Set(input.canonicalIdeaIds).size !== input.canonicalIdeaIds.length) {
        throw new Error('Canonical idea selection contains duplicates.');
      }
      const transcript = await readNodeByType('transcript', input.transcriptId);
      const canonicalIdeas = await Promise.all(
        input.canonicalIdeaIds.map((id) => readNodeByType('canonical-idea', id)),
      );
      if (canonicalIdeas.some((idea) => idea.transcript_id !== transcript.id)) {
        throw new Error('Selected canonical ideas must belong to the current transcript.');
      }

      const evidence = buildWikiEvidence(transcript, canonicalIdeas);
      const sourceRefs = evidence.map((item) => ({
        id: item.id,
        kind: 'transcript' as const,
        node_id: transcript.id,
        title: transcript.title,
        url: transcript.source_url,
        ...(item.locator ? { locator: item.locator } : {}),
        verification: 'source-backed' as const,
      }));
      const topicKey = toNodeId(input.suggestedTitle ?? canonicalIdeas[0]?.title ?? transcript.title);
      const prompt = buildCompilePrompt(transcript, canonicalIdeas, evidence, input.suggestedTitle);

      let llm = await routeLlm('wiki-compile', prompt, { system: SYSTEM_PROMPT, bypassCache: true });
      let result = WikiCompileResultSchema.parse(parseJson(llm.text));
      let quality = validateResult(
        result,
        new Set(canonicalIdeas.map((idea) => idea.id)),
        new Set(sourceRefs.map((sourceRef) => sourceRef.id)),
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
        );
      }

      const operation = WikiOperationSchema.parse(result.operation);
      const draftId = appendDatetimeFilenameSegment(`${topicKey}-wiki-draft`, new Date());
      const body = result.sections
        .map((section) => `<!-- wiki-section:${section.id} -->\n\n## ${section.heading}\n\n${section.body}`)
        .join('\n\n');
      const created = await createNode({
        type: 'wiki-draft',
        id: draftId,
        title: result.topic.title,
        body,
        tags: canonicalIdeas[0]?.tags.filter((tag) => tag.startsWith('d:')) ?? [],
        extra: {
          topic_key: result.topic.topic_key || topicKey,
          operation,
          source_canonical_idea_ids: canonicalIdeas.map((idea) => idea.id),
          source_transcript_ids: [transcript.id],
          source_ids: transcript.source_id ? [transcript.source_id] : [],
          source_refs: sourceRefs,
          represented_canonical_idea_ids: result.coverage.represented_canonical_idea_ids,
          omitted_canonical_idea_ids: result.coverage.omitted_canonical_ideas.map((item) => item.id),
          sections: result.sections,
          proposed_links: result.links,
          quality_score: quality.score,
          warning: quality.warnings.join(' ') || undefined,
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
            { name: 'resolve-evidence', status: 'completed', output: { evidenceCount: evidence.length } },
            { name: 'compile', status: 'completed', output: { operation } },
            { name: 'validate', status: 'completed', output: { qualityScore: quality.score } },
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
