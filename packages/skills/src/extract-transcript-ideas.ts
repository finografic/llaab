import { autoTag, createNode, getNodeFilePath, updateNode } from '@llaab/core';
import { llmExtractWithTrace } from '@llaab/ingestion';
import type { LlmExtractionMeta } from '@llaab/ingestion';
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
}

export async function extractTranscriptIdeas(input: ExtractTranscriptIdeasInput) {
  return runSkill(
    'extract-transcript-ideas',
    async () => {
      const { ideas, summary, llmMeta } = await llmExtractWithTrace(input.transcript.body);

      // Create an IdeaNode for each extracted idea string
      const ideaIds: string[] = [];

      for (const ideaTitle of ideas) {
        const inferredTags = autoTag(ideaTitle, '');
        const { id } = await createNode({
          type: 'idea',
          title: ideaTitle,
          body: '',
          tags: inferredTags,
          extra: {
            origin: 'extracted',
            source_id: input.transcript.id,
            llm_model: llmMeta.model,
            llm_provider: llmMeta.provider,
            llm_duration_ms: llmMeta.durationMs,
            llm_prompt_tokens: llmMeta.promptTokens,
            llm_completion_tokens: llmMeta.completionTokens,
          },
        });
        ideaIds.push(id);
      }

      // Back-link extracted idea IDs onto the transcript node
      if (ideaIds.length > 0) {
        const transcriptPath = getNodeFilePath('transcript', input.transcript.id);
        await updateNode(transcriptPath, (node) => ({
          ...node,
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
      };
    },
    input,
  );
}
