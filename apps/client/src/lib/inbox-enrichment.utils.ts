import type { ParsedInboxCapture } from 'lib/inbox-capture.utils';

export interface InboxEnrichmentSuggestion {
  suggested_route_kind?: string;
  suggested_tags: string[];
  link_category?: 'docs' | 'post' | 'repo' | 'package' | 'resource' | 'unknown';
  markdown_kind?: 'docs' | 'skill_draft' | 'prompt' | 'instruction' | 'note' | 'unknown';
  code_language?: string;
  destination?: 'working_vault' | 'resource' | 'skill' | 'prompt' | 'instruction' | 'knowledge' | 'archive';
  rationale?: string;
}

const LINK_CATEGORIES = new Set(['docs', 'post', 'repo', 'package', 'resource', 'unknown'] as const);

const MARKDOWN_KINDS = new Set(['docs', 'skill_draft', 'prompt', 'instruction', 'note', 'unknown'] as const);

const DESTINATIONS = new Set([
  'working_vault',
  'resource',
  'skill',
  'prompt',
  'instruction',
  'knowledge',
  'archive',
] as const);

export function buildInboxEnrichmentPrompt(capture: ParsedInboxCapture): {
  system: string;
  prompt: string;
} {
  return {
    system: [
      'You classify LLAAB inbox captures. Return ONLY compact JSON matching this shape:',
      '{',
      '  "suggested_route_kind": string,',
      '  "suggested_tags": string[],',
      '  "link_category": "docs"|"post"|"repo"|"package"|"resource"|"unknown",',
      '  "markdown_kind": "docs"|"skill_draft"|"prompt"|"instruction"|"note"|"unknown",',
      '  "code_language": string,',
      '  "destination": "working_vault"|"resource"|"skill"|"prompt"|"instruction"|"knowledge"|"archive",',
      '  "rationale": string',
      '}',
      'Do not invent secrets. Prefer short tags. Keep deterministic route_kind unless clearly wrong.',
    ].join('\n'),
    prompt: JSON.stringify(
      {
        title: capture.node.title,
        route_kind: capture.routeKind,
        platform: capture.platform,
        tags: capture.node.tags,
        raw_text: capture.rawText.slice(0, 4000),
        payload: capture.provenance?.payload ?? {},
      },
      null,
      2,
    ),
  };
}

export function parseInboxEnrichmentSuggestion(text: string): InboxEnrichmentSuggestion {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('Enrichment response did not include JSON.');
  }

  const parsed: unknown = JSON.parse(candidate.slice(start, end + 1));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Enrichment JSON must be an object.');
  }

  const record = parsed as Record<string, unknown>;
  const suggestedTags = Array.isArray(record['suggested_tags'])
    ? record['suggested_tags'].filter((tag): tag is string => typeof tag === 'string')
    : [];

  return {
    suggested_route_kind:
      typeof record['suggested_route_kind'] === 'string' ? record['suggested_route_kind'] : undefined,
    suggested_tags: suggestedTags,
    link_category: asEnum(record['link_category'], LINK_CATEGORIES),
    markdown_kind: asEnum(record['markdown_kind'], MARKDOWN_KINDS),
    code_language: typeof record['code_language'] === 'string' ? record['code_language'] : undefined,
    destination: asEnum(record['destination'], DESTINATIONS),
    rationale: typeof record['rationale'] === 'string' ? record['rationale'] : undefined,
  };
}

export function mergeSuggestedTags(current: string[], suggested: string[]): string[] {
  const next = [...current];
  for (const tag of suggested) {
    const normalized = tag.trim().toLowerCase();
    if (!normalized) continue;
    if (!next.includes(normalized)) next.push(normalized);
  }
  return next;
}

function asEnum<T extends string>(value: unknown, allowed: Set<T> | ReadonlySet<T>): T | undefined {
  if (typeof value !== 'string') return undefined;
  return allowed.has(value as T) ? (value as T) : undefined;
}
