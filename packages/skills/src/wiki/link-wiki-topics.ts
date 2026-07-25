import { listKnowledgeWikis } from '@llaab/core';
import { routeLlm } from '@llaab/llm';
import type { WikiLinkCandidatePage } from './wiki-link.utils.js';
import type { WikiLink } from '@llaab/schemas';

import {
  parseWikiLinkSuggestions,
  validateWikiLinkSuggestions,
  WIKI_LINK_ENRICHMENT_RELATIONS,
} from './wiki-link.utils.js';

export interface LinkWikiTopicsInput {
  candidates: WikiLinkCandidatePage[];
  /** Optional injected wiki index for tests. */
  existingWikis?: Array<{
    id: string;
    title: string;
    summary: string;
    tags: string[];
  }>;
}

export interface LinkWikiTopicsOutput {
  linksBySourceKey: Map<string, WikiLink[]>;
  warnings: string[];
  attempted: boolean;
}

const WIKI_LINK_SYSTEM_PROMPT = `Suggest typed wiki links among the supplied topic pages.
Return ONLY JSON: {"links":[{"source_temporary_key":"...","target":"...","relation":"related-to","note":"semantic reason"}]}.
Rules:
- Use only supplied temporary keys or existing wiki ids as targets.
- Allowed relations: ${WIKI_LINK_ENRICHMENT_RELATIONS.join(', ')}. Do not use supersedes.
- Every link needs a concise semantic rationale. Reject shared d:* domains or generic tag overlap alone.
- Prefer sparse, high-confidence links. Empty links array is valid.
- No self-links.`;

/**
 * Optional enrichment after compile identities are known. Failures become warnings only.
 */
export async function linkWikiTopics(input: LinkWikiTopicsInput): Promise<LinkWikiTopicsOutput> {
  if (input.candidates.length === 0) {
    return { linksBySourceKey: new Map(), warnings: [], attempted: false };
  }

  const existing =
    input.existingWikis ??
    (await listKnowledgeWikis()).map((wiki) => ({
      id: wiki.id,
      title: wiki.title,
      summary: wiki.summary,
      tags: wiki.tags,
    }));

  try {
    const llm = await routeLlm(
      'wiki-link',
      JSON.stringify({
        batch_pages: input.candidates,
        existing_wikis: existing.slice(0, 40),
        instructions: {
          sparse: true,
          require_semantic_note: true,
          forbid_domain_only: true,
          forbid_supersedes: true,
        },
      }),
      { system: WIKI_LINK_SYSTEM_PROMPT, bypassCache: true },
    );

    const suggestions = parseWikiLinkSuggestions(llm.text);
    const validated = validateWikiLinkSuggestions({
      suggestions,
      candidates: input.candidates,
      existingWikiIds: new Set(existing.map((wiki) => wiki.id)),
    });
    return {
      linksBySourceKey: validated.linksBySourceKey,
      warnings: validated.warnings,
      attempted: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      linksBySourceKey: new Map(),
      warnings: [`wiki-link skipped: ${message}`],
      attempted: true,
    };
  }
}
