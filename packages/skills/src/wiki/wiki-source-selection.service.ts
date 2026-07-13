import { readNodeByType } from '@llaab/core';
import type { CompileWikiDraftInput } from './wiki-compile.types.js';
import type { CanonicalIdeaNode, IdeaNode, SourceNode, TranscriptNode } from '@llaab/schemas';

export interface WikiSourceSelection {
  entryTranscript: TranscriptNode;
  canonicalIdeas: CanonicalIdeaNode[];
  candidateIdeas: IdeaNode[];
  transcripts: TranscriptNode[];
  sources: SourceNode[];
  candidateTitlesByCanonicalId: Map<string, string[]>;
}

export async function resolveWikiSourceSelection(input: CompileWikiDraftInput): Promise<WikiSourceSelection> {
  if (input.canonicalIdeaIds.length === 0) throw new Error('Select at least one canonical idea.');
  if (new Set(input.canonicalIdeaIds).size !== input.canonicalIdeaIds.length) {
    throw new Error('Canonical idea selection contains duplicates.');
  }

  const entryTranscript = await readNodeByType('transcript', input.transcriptId);
  const canonicalIdeas = await Promise.all(
    input.canonicalIdeaIds.map((id) => readNodeByType('canonical-idea', id)),
  );

  if (
    input.entryPath === 'manual' &&
    canonicalIdeas.some((idea) => idea.transcript_id !== entryTranscript.id)
  ) {
    throw new Error('Manual wiki selection must use canonical ideas from the route transcript.');
  }

  const transcriptIds = [...new Set(canonicalIdeas.map((idea) => idea.transcript_id))];
  const transcripts = await Promise.all(
    transcriptIds.map((id) =>
      id === entryTranscript.id ? Promise.resolve(entryTranscript) : readNodeByType('transcript', id),
    ),
  );
  const candidateIds = [...new Set(canonicalIdeas.flatMap((idea) => idea.source_candidate_idea_ids))];
  const candidateIdeas = await Promise.all(candidateIds.map((id) => readNodeByType('idea', id)));
  const candidateById = new Map(candidateIdeas.map((idea) => [idea.id, idea]));
  const candidateTitlesByCanonicalId = new Map(
    canonicalIdeas.map((idea) => [
      idea.id,
      idea.source_candidate_idea_ids.map((id) => candidateById.get(id)!.title),
    ]),
  );
  const sourceIds = [...new Set(transcripts.flatMap((transcript) => transcript.source_id ?? []))];
  const sources = await Promise.all(sourceIds.map((id) => readNodeByType('source', id)));

  return {
    entryTranscript,
    canonicalIdeas,
    candidateIdeas,
    transcripts,
    sources,
    candidateTitlesByCanonicalId,
  };
}
