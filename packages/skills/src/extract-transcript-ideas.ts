import { autoTag, createNode, getNodeFilePath, updateNode } from '@llaab/core';
import { llmExtract } from '@llaab/ingestion';
import type { TranscriptNode } from '@llaab/schemas';

import { runSkill } from './runner.js';

export interface ExtractTranscriptIdeasInput {
  transcript: TranscriptNode;
}

export interface ExtractTranscriptIdeasOutput {
  ideaIds: string[];
  summary: string;
  producedNodeIds: string[];
}

export async function extractTranscriptIdeas(input: ExtractTranscriptIdeasInput) {
  return runSkill(
    'extract-transcript-ideas',
    async () => {
      const { ideas, summary } = await llmExtract(input.transcript.body);

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
            sourceId: input.transcript.id,
          },
        });
        ideaIds.push(id);
      }

      // Back-link extracted idea IDs onto the transcript node
      if (ideaIds.length > 0) {
        const transcriptPath = getNodeFilePath('transcript', input.transcript.id);
        await updateNode(transcriptPath, (node) => ({
          ...node,
          extractedIdeaIds: [...((node as TranscriptNode).extractedIdeaIds ?? []), ...ideaIds],
        }));
      }

      return {
        ideaIds,
        summary,
        producedNodeIds: ideaIds,
      };
    },
    input,
  );
}
