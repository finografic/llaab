import { HermesInboxPlatformSchema, HermesInboxRouteKindSchema } from '@llaab/schemas';
import type { HermesInboxPlatform, HermesInboxRouteKind, LabNode } from '@llaab/schemas';

export const INBOX_LIST_TAGS = ['hermes', 'inbox'] as const;

export interface InboxCaptureProvenance {
  route_kind?: string;
  source?: {
    platform?: string;
    user_id?: string;
    chat_id?: string;
    message_id?: string;
    timestamp?: string;
  };
  payload?: Record<string, unknown>;
}

export interface ParsedInboxCapture {
  node: LabNode;
  routeKind: HermesInboxRouteKind | 'unknown';
  platform: HermesInboxPlatform | 'unknown';
  receivedAt: string;
  provenance: InboxCaptureProvenance | null;
  rawText: string;
  bodyWithoutJson: string;
  parseError: string | null;
  malformed: boolean;
}

const FENCED_JSON_RE = /```json\s*([\s\S]*?)```/i;

export function isInboxCaptureNode(node: LabNode): boolean {
  const tags = node.tags ?? [];
  if (tags.some((tag) => tag.startsWith('inbox:'))) return true;
  if (node.body?.includes('# Hermes Inbox Item')) return true;
  return node.type === 'transcript' && tags.includes('hermes') && tags.includes('inbox');
}

export function parseInboxCapture(node: LabNode): ParsedInboxCapture {
  const body = node.body ?? '';
  const { provenance, parseError, bodyWithoutJson } = extractProvenance(body);
  const routeKind = resolveRouteKind(node, provenance);
  const platform = resolvePlatform(provenance);
  const receivedAt =
    (typeof provenance?.source?.timestamp === 'string' && provenance.source.timestamp) || node.created_at;
  const rawText = extractRawText(bodyWithoutJson, provenance);

  return {
    node,
    routeKind,
    platform,
    receivedAt,
    provenance,
    rawText,
    bodyWithoutJson,
    parseError,
    malformed: Boolean(parseError),
  };
}

export function routeKindLabel(routeKind: string): string {
  return routeKind.replaceAll('_', ' ');
}

function extractProvenance(body: string): {
  provenance: InboxCaptureProvenance | null;
  parseError: string | null;
  bodyWithoutJson: string;
} {
  const match = FENCED_JSON_RE.exec(body);
  if (!match) {
    return { provenance: null, parseError: null, bodyWithoutJson: body.trim() };
  }

  const jsonText = match[1]?.trim() ?? '';
  const bodyWithoutJson = `${body.slice(0, match.index)}${body.slice(match.index + match[0].length)}`
    .replace(/^#\s*Hermes Inbox Item\s*/i, '')
    .trim();

  try {
    const parsed: unknown = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        provenance: null,
        parseError: 'Inbox provenance JSON is not an object.',
        bodyWithoutJson,
      };
    }

    return {
      provenance: parsed,
      parseError: null,
      bodyWithoutJson,
    };
  } catch {
    return {
      provenance: null,
      parseError: 'Inbox provenance JSON could not be parsed.',
      bodyWithoutJson,
    };
  }
}

function resolveRouteKind(
  node: LabNode,
  provenance: InboxCaptureProvenance | null,
): HermesInboxRouteKind | 'unknown' {
  const fromBody = provenance?.route_kind;
  if (typeof fromBody === 'string') {
    const parsed = HermesInboxRouteKindSchema.safeParse(fromBody);
    if (parsed.success) return parsed.data;
    return 'unknown';
  }

  if (node.type === 'transcript' && (node.tags.includes('hermes') || node.tags.includes('inbox'))) {
    return 'youtube_url';
  }

  const tagKind = routeKindFromTags(node.tags);
  if (tagKind) return tagKind;

  return 'unknown';
}

function resolvePlatform(provenance: InboxCaptureProvenance | null): HermesInboxPlatform | 'unknown' {
  const platform = provenance?.source?.platform;
  if (typeof platform !== 'string') return 'unknown';
  const parsed = HermesInboxPlatformSchema.safeParse(platform);
  return parsed.success ? parsed.data : 'unknown';
}

function routeKindFromTags(tags: string[]): HermesInboxRouteKind | undefined {
  if (tags.includes('inbox:todo')) return 'todo';
  if (tags.includes('inbox:image')) return 'image';
  if (tags.includes('inbox:snippet')) return 'code_snippet';
  if (tags.includes('inbox:github')) return 'github_repo';
  if (tags.includes('inbox:docs') && tags.includes('inbox:link')) return 'docs_link';
  if (tags.includes('inbox:post')) return 'post_link';
  if (tags.includes('inbox:code') && tags.includes('inbox:link')) return 'code_link';
  if (tags.includes('inbox:docs') && tags.includes('inbox:attachment')) return 'docs_attachment';
  if (tags.includes('inbox:code') && tags.includes('inbox:attachment')) return 'code_attachment';
  if (tags.includes('inbox:attachment')) return 'attachment';
  if (tags.includes('inbox:link')) return 'web_link';
  if (tags.includes('inbox:raw')) return 'raw';
  return undefined;
}

function extractRawText(bodyWithoutJson: string, provenance: InboxCaptureProvenance | null): string {
  const trimmed = bodyWithoutJson.trim();
  if (trimmed) return trimmed;

  const payload = provenance?.payload;
  if (!payload) return '';

  for (const key of ['url', 'text', 'command', 'raw_text'] as const) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return '';
}
