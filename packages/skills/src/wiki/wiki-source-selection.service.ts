import { readNodeByType } from '@llaab/core';
import type { CompileWikiDraftInput } from './wiki-compile.types.js';
import type { CanonicalIdeaNode, IdeaNode, ResourceNode, SourceNode, TranscriptNode } from '@llaab/schemas';

export interface WikiSourceSelection {
  entryTranscript: TranscriptNode;
  canonicalIdeas: CanonicalIdeaNode[];
  candidateIdeas: IdeaNode[];
  transcripts: TranscriptNode[];
  sources: SourceNode[];
  candidateTitlesByCanonicalId: Map<string, string[]>;
}

function canonicalIdeaSourceId(idea: CanonicalIdeaNode): string {
  return idea.source_node_type === 'resource' && idea.source_node_id
    ? idea.source_node_id
    : idea.transcript_id;
}

function canonicalIdeaMatchesSource(idea: CanonicalIdeaNode, sourceId: string): boolean {
  return idea.transcript_id === sourceId || idea.source_node_id === sourceId;
}

function articleResourceAsTranscript(resource: ResourceNode): TranscriptNode {
  const sourceUrl = resource.url ?? resource.requested_url;
  if (!sourceUrl) {
    throw new Error(`Article resource ${resource.id} cannot be used for wiki evidence without a source URL.`);
  }

  return {
    id: resource.id,
    type: 'transcript',
    title: resource.title,
    tags: resource.tags,
    related: resource.related,
    created_at: resource.created_at,
    ...(resource.updated_at ? { updated_at: resource.updated_at } : {}),
    status: resource.status,
    body: resource.body,
    ...(resource.source_id ? { source_id: resource.source_id } : {}),
    source_url: sourceUrl,
    source_type: 'article',
    ...(resource.source_published_at ? { source_published_at: resource.source_published_at } : {}),
    ...(resource.author ? { author: resource.author } : {}),
    ...(resource.description ? { summary: resource.description } : {}),
    raw_length: resource.body.length,
    clean_length: resource.body.length,
    extracted_idea_ids: resource.extracted_idea_ids,
    extracted_skill_ids: [],
    ...(resource.canonical_coverage ? { canonical_coverage: resource.canonical_coverage } : {}),
    ...(resource.llm_model ? { llm_model: resource.llm_model } : {}),
    ...(resource.llm_provider ? { llm_provider: resource.llm_provider } : {}),
    ...(resource.llm_duration_ms != null ? { llm_duration_ms: resource.llm_duration_ms } : {}),
    ...(resource.llm_prompt_tokens != null ? { llm_prompt_tokens: resource.llm_prompt_tokens } : {}),
    ...(resource.llm_completion_tokens != null
      ? { llm_completion_tokens: resource.llm_completion_tokens }
      : {}),
  };
}

async function readWikiEvidenceSource(id: string): Promise<TranscriptNode> {
  try {
    return await readNodeByType('transcript', id);
  } catch (transcriptError) {
    try {
      const resource = await readNodeByType('resource', id);
      if (resource.resource_type !== 'article') throw transcriptError;
      return articleResourceAsTranscript(resource);
    } catch {
      throw transcriptError;
    }
  }
}

export async function resolveWikiSourceSelection(input: CompileWikiDraftInput): Promise<WikiSourceSelection> {
  if (input.canonicalIdeaIds.length === 0) throw new Error('Select at least one canonical idea.');
  if (new Set(input.canonicalIdeaIds).size !== input.canonicalIdeaIds.length) {
    throw new Error('Canonical idea selection contains duplicates.');
  }

  const entryTranscript = await readWikiEvidenceSource(input.transcriptId);
  const canonicalIdeas = await Promise.all(
    input.canonicalIdeaIds.map((id) => readNodeByType('canonical-idea', id)),
  );

  if (
    input.entryPath === 'manual' &&
    canonicalIdeas.some((idea) => !canonicalIdeaMatchesSource(idea, entryTranscript.id))
  ) {
    throw new Error('Manual wiki selection must use canonical ideas from the route source.');
  }

  const transcriptIds = [...new Set(canonicalIdeas.map(canonicalIdeaSourceId))];
  const transcripts = await Promise.all(
    transcriptIds.map((id) =>
      id === entryTranscript.id ? Promise.resolve(entryTranscript) : readWikiEvidenceSource(id),
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
