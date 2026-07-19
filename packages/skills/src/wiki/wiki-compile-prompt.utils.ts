import type {
  CanonicalIdeaNode,
  KnowledgeWikiPage,
  TranscriptNode,
  WikiEvidenceItem,
  WikiTopicProposal,
} from '@llaab/schemas';

export const WIKI_COMPILE_SYSTEM_PROMPT = `Compile one wiki topic from the supplied proposal and evidence roles.
Return only JSON with operation, topic, summary, sections, links, source_refs, coverage,
change_summary, unresolved_questions, and contested_claims. Use only supplied ids and URLs.
Synthesize one coherent topic across primary ideas; use supporting ideas as context/evidence only.
Do not create one section per canonical idea. Every substantive section needs source_ref_ids and
source_canonical_idea_ids. Do not create links unless a target wiki id is supplied. Use create for a
new topic; use update, no-op, or needs-review for a target wiki. Generate a concise wiki title from
the selected evidence; treat any suggested title as a hint, not the final title. Preserve unrelated
existing sections byte-for-byte.

Use this exact shape:
{"operation":"create","topic":{"topic_key":"lowercase-node-id","title":"Title","aliases":[]},
"summary":"Summary","sections":[{"id":"lowercase-section-id","heading":"Heading","body":"Body",
"source_ref_ids":["supplied-evidence-id"],"source_canonical_idea_ids":["supplied-canonical-id"]}],
"links":[{"target_wiki_id":"supplied-related-wiki-id","relation":"related-to","note":"Reason"}],
"source_refs":[],"coverage":{"represented_canonical_idea_ids":["supplied-canonical-id"],
"omitted_canonical_ideas":[]},"change_summary":"Change","unresolved_questions":[],
"contested_claims":[]}.
Allowed link relations: related-to, depends-on, extends, contrasts-with, example-of, supports,
supersedes. Omit links when no supplied related or target wiki id applies.`;

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

function toCanonicalPayload(idea: CanonicalIdeaNode) {
  return {
    id: idea.id,
    transcript_id: idea.transcript_id,
    title: idea.title,
    body: idea.body,
    key_claims: idea.key_claims,
    tags: idea.tags,
  };
}

export function buildWikiCompilePrompt(input: {
  transcripts: TranscriptNode[];
  canonicalIdeas: CanonicalIdeaNode[];
  primaryCanonicalIdeas: CanonicalIdeaNode[];
  supportingCanonicalIdeas: CanonicalIdeaNode[];
  evidence: WikiEvidenceItem[];
  proposal?: Pick<
    WikiTopicProposal,
    | 'id'
    | 'discovery_batch_id'
    | 'topic_key'
    | 'title'
    | 'rationale'
    | 'primary_canonical_idea_ids'
    | 'supporting_canonical_idea_ids'
    | 'domains'
    | 'tags'
    | 'operation'
    | 'existing_wiki_id'
    | 'coherence_score'
    | 'warnings'
  >;
  suggestedTitle?: string;
  suggestedTopicKey?: string;
  existingWiki?: KnowledgeWikiPage;
  relatedWikis: KnowledgeWikiPage[];
  preResolvedOperation: 'create' | 'update' | 'no-op' | 'needs-review';
}): string {
  const primary = input.primaryCanonicalIdeas.length > 0 ? input.primaryCanonicalIdeas : input.canonicalIdeas;
  const supporting = input.supportingCanonicalIdeas;

  return JSON.stringify({
    operation: input.preResolvedOperation,
    proposal: input.proposal
      ? {
          id: input.proposal.id,
          discoveryBatchId: input.proposal.discovery_batch_id,
          topicKey: input.proposal.topic_key,
          title: input.proposal.title,
          rationale: input.proposal.rationale,
          primaryCanonicalIdeaIds: input.proposal.primary_canonical_idea_ids,
          supportingCanonicalIdeaIds: input.proposal.supporting_canonical_idea_ids,
          domains: input.proposal.domains,
          tags: input.proposal.tags,
          operation: input.proposal.operation,
          existingWikiId: input.proposal.existing_wiki_id,
          coherenceScore: input.proposal.coherence_score,
          warnings: input.proposal.warnings,
        }
      : undefined,
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
    // Candidate related wikis for comparison only — shared tags must not create edges.
    relatedWikis: input.relatedWikis.map((wiki) => ({
      id: wiki.id,
      title: wiki.title,
      summary: wiki.summary,
      tags: wiki.tags,
    })),
    // `canonicalIdeas` retained for compile-test/model compatibility; roles are authoritative.
    canonicalIdeas: input.canonicalIdeas.map(toCanonicalPayload),
    selectedCanonicalIdeas: input.canonicalIdeas.map(toCanonicalPayload),
    primaryCanonicalIdeas: primary.map(toCanonicalPayload),
    supportingCanonicalIdeas: supporting.map(toCanonicalPayload),
    evidence: input.evidence,
    constraints: {
      preserveManualContent: true,
      requireSourceRefs: true,
      preferDeltaUpdate: true,
    },
  });
}
