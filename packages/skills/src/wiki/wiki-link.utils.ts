import { WikiLinkRelationSchema, z } from '@llaab/schemas';
import type { WikiLink, WikiLinkRelation } from '@llaab/schemas';

/** Relations allowed for normal wiki-link enrichment (lifecycle supersedes excluded). */
export const WIKI_LINK_ENRICHMENT_RELATIONS = [
  'related-to',
  'depends-on',
  'supports',
  'contrasts-with',
  'extends',
  'example-of',
] as const satisfies readonly WikiLinkRelation[];

const ENRICHMENT_RELATION_SET = new Set<string>(WIKI_LINK_ENRICHMENT_RELATIONS);

const DOMAIN_ONLY_NOTE = /^(?:same|shared|overlapping)?\s*(?:d:)?[a-z0-9-]+\s*(?:domain|tag)?\.?$/i;
const GENERIC_TAG_NOTE = /^(?:same|shared|overlapping)\s+tags?\.?$/i;

export interface WikiLinkCandidatePage {
  temporaryKey: string;
  finalWikiId?: string;
  title: string;
  summary: string;
  tags: string[];
  operation: 'create' | 'update';
}

export interface WikiLinkSuggestion {
  source_temporary_key: string;
  target: string;
  relation: WikiLinkRelation;
  note: string;
}

export const WikiLinkSuggestionRowSchema = z
  .object({
    source_temporary_key: z.string().optional(),
    source: z.string().optional(),
    target: z.string().optional(),
    target_wiki_id: z.string().optional(),
    relation: z.string(),
    note: z.string(),
  })
  .passthrough();

export const WikiLinkSuggestionsPayloadSchema = z
  .object({
    links: z.array(WikiLinkSuggestionRowSchema),
  })
  .passthrough();

export interface ValidatedWikiLinkBundle {
  linksBySourceKey: Map<string, WikiLink[]>;
  warnings: string[];
  rejected: Array<{ suggestion: WikiLinkSuggestion; reason: string }>;
}

function normalizeRelation(value: unknown): WikiLinkRelation | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase().replace(/[ _]+/g, '-');
  const parsed = WikiLinkRelationSchema.safeParse(normalized);
  if (!parsed.success) return undefined;
  if (!ENRICHMENT_RELATION_SET.has(parsed.data)) return undefined;
  return parsed.data;
}

function isDomainOrTagOnlyNote(note: string, sourceTags: string[], targetTags: string[]): boolean {
  const trimmed = note.trim();
  if (DOMAIN_ONLY_NOTE.test(trimmed) || GENERIC_TAG_NOTE.test(trimmed)) return true;
  const sourceDomains = sourceTags.filter((tag) => tag.startsWith('d:'));
  const targetDomains = targetTags.filter((tag) => tag.startsWith('d:'));
  const sharedDomains = sourceDomains.filter((tag) => targetDomains.includes(tag));
  if (sharedDomains.length === 0) return false;
  const normalizedNote = trimmed.toLowerCase().replace(/^d:/, '');
  return sharedDomains.some((domain) => {
    const bare = domain.slice(2);
    return (
      normalizedNote === bare ||
      normalizedNote === domain.toLowerCase() ||
      normalizedNote === `${bare} domain` ||
      normalizedNote === `same ${bare}` ||
      normalizedNote === `shared ${bare}`
    );
  });
}

/**
 * Validate wiki-link suggestions. Temporary keys resolve via `resolveTargetId`.
 * Link inference failures are returned as warnings/rejected — never throw.
 */
export function validateWikiLinkSuggestions(input: {
  suggestions: WikiLinkSuggestion[];
  candidates: WikiLinkCandidatePage[];
  existingWikiIds: ReadonlySet<string>;
}): ValidatedWikiLinkBundle {
  const byKey = new Map(input.candidates.map((page) => [page.temporaryKey, page]));
  const allowedTargets = new Set<string>([
    ...input.existingWikiIds,
    ...input.candidates.map((page) => page.finalWikiId ?? page.temporaryKey),
    ...input.candidates.map((page) => page.temporaryKey),
  ]);
  const resolveTargetId = (target: string, sourceKey: string): string | undefined => {
    if (input.existingWikiIds.has(target)) return target;
    const candidate = byKey.get(target);
    if (candidate) return candidate.finalWikiId ?? candidate.temporaryKey;
    // Allow targeting another batch page by final id.
    const byFinal = input.candidates.find((page) => page.finalWikiId === target);
    if (byFinal) return byFinal.finalWikiId;
    if (target === sourceKey) return undefined;
    return allowedTargets.has(target) ? target : undefined;
  };

  const linksBySourceKey = new Map<string, WikiLink[]>();
  const warnings: string[] = [];
  const rejected: ValidatedWikiLinkBundle['rejected'] = [];
  const seen = new Set<string>();

  for (const raw of input.suggestions) {
    const source = byKey.get(raw.source_temporary_key);
    if (!source) {
      rejected.push({ suggestion: raw, reason: `Unknown source temporary key: ${raw.source_temporary_key}` });
      continue;
    }
    const relation = normalizeRelation(raw.relation);
    if (!relation) {
      rejected.push({
        suggestion: raw,
        reason: `Unsupported or lifecycle-only relation: ${String(raw.relation)}`,
      });
      continue;
    }
    const note = typeof raw.note === 'string' ? raw.note.trim() : '';
    if (!note) {
      rejected.push({ suggestion: raw, reason: 'Link note is required.' });
      continue;
    }
    const resolvedTarget = resolveTargetId(raw.target, source.temporaryKey);
    if (!resolvedTarget) {
      rejected.push({ suggestion: raw, reason: `Unknown link target: ${raw.target}` });
      continue;
    }
    const sourceFinalId = source.finalWikiId ?? source.temporaryKey;
    if (resolvedTarget === sourceFinalId || resolvedTarget === source.temporaryKey) {
      rejected.push({ suggestion: raw, reason: 'Self-links are not allowed.' });
      continue;
    }
    const targetPage =
      byKey.get(raw.target) ??
      input.candidates.find(
        (page) => page.finalWikiId === resolvedTarget || page.temporaryKey === resolvedTarget,
      );
    const targetTags = targetPage?.tags ?? [];
    if (isDomainOrTagOnlyNote(note, source.tags, targetTags)) {
      rejected.push({
        suggestion: raw,
        reason: 'Link rationale must be semantic; domain/tag overlap alone is insufficient.',
      });
      continue;
    }
    const edgeKey = `${source.temporaryKey}:${relation}:${resolvedTarget}`;
    if (seen.has(edgeKey)) {
      rejected.push({ suggestion: raw, reason: 'Duplicate directed link.' });
      continue;
    }
    seen.add(edgeKey);
    const bucket = linksBySourceKey.get(source.temporaryKey) ?? [];
    bucket.push({ target_wiki_id: resolvedTarget, relation, note });
    linksBySourceKey.set(source.temporaryKey, bucket);
  }

  if (rejected.length > 0) {
    warnings.push(`Rejected ${rejected.length} wiki-link suggestion(s); promoting without those links.`);
  }

  return { linksBySourceKey, warnings, rejected };
}

export function parseWikiLinkSuggestions(text: string): WikiLinkSuggestion[] {
  const stripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  const parsed: unknown = JSON.parse(stripped);
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { links?: unknown }).links)
      ? (parsed as { links: unknown[] }).links
      : null;
  if (!rows) throw new Error('wiki-link output must be a JSON array or { links: [] }.');

  return normalizeWikiLinkSuggestions(rows);
}

export function normalizeWikiLinkSuggestions(rows: readonly unknown[]): WikiLinkSuggestion[] {
  return rows.flatMap((row) => {
    const parsed = WikiLinkSuggestionRowSchema.safeParse(row);
    if (!parsed.success) return [];
    const value = parsed.data;
    const source = value.source_temporary_key ?? value.source;
    const target = value.target ?? value.target_wiki_id;
    const relation = normalizeRelation(value.relation);
    if (!source || !target || !relation || !value.note) return [];
    return [{ source_temporary_key: source, target, relation, note: value.note }];
  });
}
