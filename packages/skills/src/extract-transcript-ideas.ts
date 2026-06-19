import { autoTag, createNode, getNodeFilePath, updateNode } from '@llaab/core';
import { llmExtractWithTrace, normalizeContentTags, normalizeDomainTags } from '@llaab/ingestion';
import { appendDatetimeFilenameSegment, toNodeId } from '@llaab/schemas';
import type { ExtractionRunTrace, LlmExtractionMeta } from '@llaab/ingestion';
import type { TranscriptNode } from '@llaab/schemas';

import { runSkill } from './runner.js';

export interface ExtractTranscriptIdeasInput {
  transcript: TranscriptNode;
}

export interface ExtractTranscriptIdeasOutput {
  ideaIds: string[];
  summary: string;
  producedNodeIds: string[];
  llmMeta: LlmExtractionMeta;
  runTrace: ExtractionRunTrace;
}

export async function extractTranscriptIdeas(input: ExtractTranscriptIdeasInput) {
  return runSkill(
    'extract-transcript-ideas',
    async () => {
      const { ideas, summary, llmMeta, runTrace, tags } = await llmExtractWithTrace(input.transcript.body);
      const normalizedLlmTags = normalizeContentTags(tags);
      const inferredTranscriptTags = autoTag(input.transcript.title, input.transcript.body ?? '');
      const transcriptDomainTags = normalizeDomainTags([
        ...(input.transcript.tags ?? []),
        ...inferredTranscriptTags,
      ]);

      // Create an IdeaNode for each extracted idea.
      const ideaIds: string[] = [];

      for (const [index, idea] of ideas.entries()) {
        const ideaDomainTags = idea.domainTags.filter((tag) => transcriptDomainTags.includes(tag));
        const inferredIdeaDomainTags = autoTag(idea.title, idea.tags.join(' '));
        const ideaInput = {
          type: 'idea' as const,
          title: idea.title,
          body: '',
          tags: [...new Set(['d:ingest', ...ideaDomainTags, ...inferredIdeaDomainTags, ...idea.tags])],
          extra: {
            origin: 'extracted',
            source_id: input.transcript.id,
            related: [input.transcript.id],
            llm_model: llmMeta.model,
            llm_provider: llmMeta.provider,
            llm_duration_ms: llmMeta.durationMs,
            llm_prompt_tokens: llmMeta.promptTokens,
            llm_completion_tokens: llmMeta.completionTokens,
          },
        };
        let createdIdea: Awaited<ReturnType<typeof createNode>>;
        try {
          createdIdea = await createNode(ideaInput);
        } catch (error) {
          if (!(error instanceof Error) || !error.message.includes('already exists')) {
            throw error;
          }

          createdIdea = await createNode({
            ...ideaInput,
            id: appendDatetimeFilenameSegment(
              `${toNodeId(idea.title)}-${toNodeId(llmMeta.model)}-${index + 1}`,
              new Date(),
            ),
          });
        }
        const { id } = createdIdea;
        ideaIds.push(id);
      }

      // Back-link extracted idea IDs onto the transcript node
      if (ideaIds.length > 0) {
        const transcriptPath = getNodeFilePath('transcript', input.transcript.id);
        await updateNode(transcriptPath, (node) => ({
          ...node,
          tags: [...new Set([...(node.tags ?? []), ...inferredTranscriptTags, ...normalizedLlmTags])],
          extracted_idea_ids: [...((node as TranscriptNode).extracted_idea_ids ?? []), ...ideaIds],
          llm_model: llmMeta.model,
          llm_provider: llmMeta.provider,
          llm_duration_ms: llmMeta.durationMs,
          llm_prompt_tokens: llmMeta.promptTokens,
          llm_completion_tokens: llmMeta.completionTokens,
        }));
      }

      return {
        ideaIds,
        summary,
        producedNodeIds: ideaIds,
        llmMeta,
        runTrace,
      };
    },
    input,
  );
}
