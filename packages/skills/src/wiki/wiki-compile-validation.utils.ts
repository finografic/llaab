import { getKnowledgeWikiSectionIds } from '@llaab/core';
import type {
  KnowledgeWikiPage,
  WikiCompileResult,
  WikiSectionPatch,
  WikiValidationIssue,
} from '@llaab/schemas';

export const MAX_WIKI_DRAFT_BODY_CHARS = 80_000;
const SECTION_MARKER = /<!--\s*wiki-section:([a-z0-9]+(?:[-_][a-z0-9]+)*)\s*-->/g;

export interface WikiCompileQuality {
  score: number;
  warnings: string[];
  issues: WikiValidationIssue[];
}

function duplicateIds(ids: string[]): string[] {
  return [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
}

export function validateWikiCompileResult(input: {
  result: WikiCompileResult;
  canonicalIdeaIds: Set<string>;
  allowedSourceRefs: Map<string, { node_id?: string; url?: string; locator?: string }>;
  allowedLinkTargetIds: Set<string>;
  expectedTopicKey?: string;
  hasExistingWiki: boolean;
  sourceCount: number;
  /** Primary idea titles for mechanical heading / synthesis checks. */
  primaryIdeaTitles?: string[];
  transcriptTitle?: string;
  channelOrAuthor?: string;
  coherenceIssues?: WikiValidationIssue[];
}): WikiCompileQuality {
  const { result } = input;
  const warnings: string[] = [];
  const issues: WikiValidationIssue[] = [];
  const addIssue = (code: string, message: string) => issues.push({ code, message });

  if (input.expectedTopicKey && result.topic.topic_key !== input.expectedTopicKey) {
    throw new Error(`Wiki output changed the required topic key: ${input.expectedTopicKey}`);
  }
  for (const id of duplicateIds(result.source_refs.map((ref) => ref.id))) {
    throw new Error(`Wiki output contains duplicate source ref: ${id}`);
  }
  for (const id of duplicateIds(result.sections.map((section) => section.id))) {
    throw new Error(`Wiki output contains duplicate section id: ${id}`);
  }
  for (const sourceRef of result.source_refs) {
    const allowed = input.allowedSourceRefs.get(sourceRef.id);
    if (!allowed) {
      throw new Error(`Wiki output introduced unknown source ref: ${sourceRef.id}`);
    }
    if (sourceRef.node_id !== undefined && sourceRef.node_id !== allowed.node_id) {
      throw new Error(`Wiki output changed source node id for ref: ${sourceRef.id}`);
    }
    if (sourceRef.url !== undefined && sourceRef.url !== allowed.url) {
      throw new Error(`Wiki output changed source URL for ref: ${sourceRef.id}`);
    }
    if (sourceRef.locator !== undefined && sourceRef.locator !== allowed.locator) {
      throw new Error(`Wiki output changed source locator for ref: ${sourceRef.id}`);
    }
  }
  for (const link of result.links) {
    if (!input.allowedLinkTargetIds.has(link.target_wiki_id)) {
      throw new Error(`Wiki output introduced an unavailable link target: ${link.target_wiki_id}`);
    }
    if (!link.note) {
      throw new Error(`Wiki output link lacks evidence beyond shared taxonomy: ${link.target_wiki_id}`);
    }
  }
  const duplicateLinks = duplicateIds(result.links.map((link) => `${link.relation}:${link.target_wiki_id}`));
  if (duplicateLinks.length > 0) {
    throw new Error(`Wiki output contains duplicate links: ${duplicateLinks[0]}`);
  }

  for (const section of result.sections) {
    if (section.body.trim() && section.source_ref_ids.length === 0) {
      throw new Error(`Wiki section "${section.id}" has no source references.`);
    }
    for (const id of section.source_ref_ids) {
      if (!input.allowedSourceRefs.has(id)) {
        throw new Error(`Wiki section references unknown source ref: ${id}`);
      }
    }
    for (const id of section.source_canonical_idea_ids) {
      if (!input.canonicalIdeaIds.has(id)) {
        throw new Error(`Wiki section references unknown canonical idea: ${id}`);
      }
    }
  }
  for (const id of result.coverage.represented_canonical_idea_ids) {
    if (!input.canonicalIdeaIds.has(id)) {
      throw new Error(`Wiki coverage references unknown canonical idea: ${id}`);
    }
  }
  const omittedIds = new Set(result.coverage.omitted_canonical_ideas.map((idea) => idea.id));
  for (const canonicalIdeaId of input.canonicalIdeaIds) {
    if (
      !result.coverage.represented_canonical_idea_ids.includes(canonicalIdeaId) &&
      !omittedIds.has(canonicalIdeaId)
    ) {
      throw new Error(`Wiki output does not account for selected canonical idea: ${canonicalIdeaId}`);
    }
  }
  if (result.sections.length === 0 && result.operation === 'create') {
    throw new Error('Wiki create draft has no sections.');
  }
  if (input.hasExistingWiki && result.operation === 'create') {
    throw new Error('An existing wiki target cannot produce a create draft.');
  }
  if (!input.hasExistingWiki && result.operation === 'update') {
    throw new Error('An update draft requires an existing promoted wiki target.');
  }

  if (omittedIds.size > 0) {
    addIssue('omitted-ideas', 'Some selected canonical ideas were explicitly omitted.');
  }
  if (input.sourceCount < 2) addIssue('single-source', 'Independent source corroboration is unavailable.');
  if (result.contested_claims.length > 0) addIssue('contested-claims', 'Contested claims require review.');
  if (result.unresolved_questions.length > 0) {
    addIssue('unresolved-questions', 'The draft has unresolved questions.');
  }
  if (result.sections.length === 1 && input.canonicalIdeaIds.size > 2) {
    addIssue('over-collapse', 'Several ideas were collapsed into one section.');
  }

  for (const issue of input.coherenceIssues ?? []) {
    addIssue(issue.code, issue.message);
  }

  for (const section of result.sections) {
    if (!section.body.trim()) continue;
    if (section.source_canonical_idea_ids.length === 0) {
      addIssue(
        'missing-section-idea-roles',
        `Section "${section.id}" must cite primary/supporting canonical idea ids.`,
      );
    }
  }

  warnings.push(...issues.map((issue) => issue.message));
  const score = Math.max(0, 100 - issues.length * 10 - omittedIds.size * 5);
  return { score, warnings, issues };
}

export function renderWikiDraftBody(result: WikiCompileResult): string {
  const body = result.sections
    .map((section) => {
      const citations = section.source_ref_ids.map((id) => `[^${id}]`).join(' ');
      return `<!-- wiki-section:${section.id} -->\n\n## ${section.heading}\n\n${section.body}${citations ? ` ${citations}` : ''}`;
    })
    .join('\n\n');
  if (body.length > MAX_WIKI_DRAFT_BODY_CHARS) {
    throw new Error(`Wiki draft exceeds ${MAX_WIKI_DRAFT_BODY_CHARS} character limit.`);
  }
  return body;
}

export function buildWikiSectionPatch(
  existingWiki: KnowledgeWikiPage | undefined,
  result: WikiCompileResult,
  operation: WikiCompileResult['operation'],
): WikiSectionPatch[] {
  if (!existingWiki || operation === 'no-op') return [];
  const existingIds = new Set(getKnowledgeWikiSectionIds(existingWiki.body));
  const resultIds = new Set(result.sections.map((section) => section.id));
  return [
    ...result.sections.map((section) => ({
      section_id: section.id,
      operation: existingIds.has(section.id) ? ('update' as const) : ('add' as const),
      after: section.body,
    })),
    ...[...existingIds]
      .filter((id) => !resultIds.has(id))
      .map((id) => ({ section_id: id, operation: 'unchanged' as const })),
  ];
}

function sectionsById(body: string): Map<string, string> {
  const matches = [...body.matchAll(SECTION_MARKER)];
  return new Map(
    matches.map((match, index) => [match[1]!, body.slice(match.index!, matches[index + 1]?.index).trim()]),
  );
}

export function buildWikiResultingBody(
  existingBody: string | undefined,
  proposedBody: string,
  patch: WikiSectionPatch[],
): string {
  if (!existingBody) return proposedBody;
  const current = sectionsById(existingBody);
  const proposed = sectionsById(proposedBody);
  const operationById = new Map(patch.map((item) => [item.section_id, item.operation]));
  const output: string[] = [];

  for (const [id, section] of current) {
    const operation = operationById.get(id) ?? 'unchanged';
    if (operation === 'remove') continue;
    output.push(operation === 'update' && proposed.has(id) ? proposed.get(id)! : section);
    proposed.delete(id);
  }
  for (const item of patch) {
    if (item.operation !== 'add') continue;
    const section = proposed.get(item.section_id);
    if (section) output.push(section);
  }
  const body = output.join('\n\n');
  if (body.length > MAX_WIKI_DRAFT_BODY_CHARS) {
    throw new Error(`Resulting wiki exceeds ${MAX_WIKI_DRAFT_BODY_CHARS} character limit.`);
  }
  return body;
}
