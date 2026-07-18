import type { CanonicalIdeaNode, KnowledgeWikiPage, TranscriptNode, WikiEvidenceItem } from '@llaab/schemas';

export const WIKI_COMPILE_SYSTEM_PROMPT = `Compile selected canonical ideas into a source-backed wiki draft.
Return only JSON with operation, topic, summary, sections, links, source_refs, coverage,
change_summary, unresolved_questions, and contested_claims. Use only supplied ids and URLs.
Every substantive section needs source_ref_ids and source_canonical_idea_ids. Do not create links
unless a target wiki id is supplied. Use create for a new topic; use update, no-op, or needs-review
for a target wiki. Generate a concise wiki title from the selected evidence; treat any suggested title
as a hint, not the final title. Preserve unrelated existing sections byte-for-byte.`;

export function parseWikiCompileJson(text: string): unknown {
  const stripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  if (!stripped.startsWith('{') || !stripped.endsWith('}')) {
    throw new Error('Wiki compiler returned malformed or truncated JSON.');
  }
  return JSON.parse(stripped);
}

export function buildWikiCompilePrompt(input: {
  transcripts: TranscriptNode[];
  canonicalIdeas: CanonicalIdeaNode[];
  evidence: WikiEvidenceItem[];
  suggestedTitle?: string;
  suggestedTopicKey?: string;
  existingWiki?: KnowledgeWikiPage;
  relatedWikis: KnowledgeWikiPage[];
  preResolvedOperation: 'create' | 'update' | 'no-op' | 'needs-review';
}): string {
  return JSON.stringify({
    operation: input.preResolvedOperation,
    transcripts: input.transcripts.map((transcript) => ({
      id: transcript.id,
      title: transcript.title,
      author: transcript.author,
      sourceId: transcript.source_id,
      sourceUrl: transcript.source_url,
    })),
    suggestedTitleHint: input.suggestedTitle,
    suggestedTopicKey: input.suggestedTopicKey,
    existingWiki: input.existingWiki
      ? {
          id: input.existingWiki.id,
          topicKey: input.existingWiki.topic_key,
          revision: input.existingWiki.revision,
          body: input.existingWiki.body,
          summary: input.existingWiki.summary,
          tags: input.existingWiki.tags,
        }
      : undefined,
    relatedWikis: input.relatedWikis.map((wiki) => ({
      id: wiki.id,
      title: wiki.title,
      summary: wiki.summary,
      tags: wiki.tags,
    })),
    canonicalIdeas: input.canonicalIdeas.map((idea) => ({
      id: idea.id,
      transcriptId: idea.transcript_id,
      title: idea.title,
      body: idea.body,
      keyClaims: idea.key_claims,
      tags: idea.tags,
    })),
    evidence: input.evidence,
    constraints: {
      preserveManualContent: true,
      requireSourceRefs: true,
      preferDeltaUpdate: true,
    },
  });
}
