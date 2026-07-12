import type { ParsedInboxCapture } from 'lib/inbox-capture.utils';

export interface InboxCaptureListPresentation {
  summary: string;
  secondary?: string;
  language?: string;
  sourceUrl?: string;
  copyText?: string;
  imageUrl?: string;
  isCode: boolean;
  isCommand: boolean;
}

const LINK_ROUTE_KINDS = new Set([
  'youtube_url',
  'npm_package',
  'github_repo',
  'docs_link',
  'post_link',
  'web_link',
  'code_link',
]);

export function getInboxCaptureListPresentation(capture: ParsedInboxCapture): InboxCaptureListPresentation {
  const url = payloadString(capture, 'url');
  const command = payloadString(capture, 'command');
  const fileName = attachmentString(capture, 'file_name');
  const mimeType = attachmentString(capture, 'mime_type');
  const language = normalizeLanguage(
    payloadString(capture, 'language') ?? (fileName ? languageFromFilename(fileName) : undefined),
  );
  const isCommand = capture.routeKind === 'command_candidate';
  const isCode =
    isCommand ||
    capture.routeKind === 'code_snippet' ||
    capture.routeKind === 'code_link' ||
    capture.routeKind === 'code_attachment';

  if (url || LINK_ROUTE_KINDS.has(capture.routeKind)) {
    const sourceUrl = url ?? firstHttpUrl(capture.rawText);
    const parsed = parseUrl(sourceUrl);
    return {
      summary: parsed?.hostname ?? 'Link capture',
      secondary: parsed ? `${parsed.pathname}${parsed.search}${parsed.hash}` || '/' : undefined,
      language,
      sourceUrl: sourceUrl || undefined,
      copyText: sourceUrl || undefined,
      isCode,
      isCommand,
    };
  }

  if (fileName) {
    return {
      summary: fileName,
      secondary: mimeType,
      language,
      imageUrl: getAttachmentImageUrl(capture),
      copyText: capture.rawText || fileName,
      isCode,
      isCommand,
    };
  }

  const text = command ?? capture.rawText ?? capture.bodyWithoutJson;
  return {
    summary: compactText(text) || `Inbox ${capture.routeKind.replaceAll('_', ' ')}`,
    language: isCommand ? 'shell' : language,
    copyText: text || undefined,
    isCode,
    isCommand,
  };
}

function firstHttpUrl(value: string): string | undefined {
  const match = /https?:\/\/[^\s)\]}]+/i.exec(value);
  return match?.[0].replace(/[*,.;!?_'"\]]+$/g, '');
}

function payloadString(capture: ParsedInboxCapture, key: string): string | undefined {
  const value = capture.provenance?.payload?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function attachmentString(capture: ParsedInboxCapture, key: string): string | undefined {
  const attachment = capture.provenance?.payload?.['attachment'];
  if (!attachment || typeof attachment !== 'object' || Array.isArray(attachment)) return undefined;
  const value = (attachment as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function getAttachmentImageUrl(capture: ParsedInboxCapture): string | undefined {
  const fileName = attachmentString(capture, 'file_name');
  const mimeType = attachmentString(capture, 'mime_type');
  const kind = attachmentString(capture, 'kind');
  const isImage =
    capture.routeKind === 'image' ||
    kind === 'image' ||
    Boolean(mimeType?.startsWith('image/')) ||
    Boolean(fileName && /\.(avif|gif|jpe?g|png|webp)$/i.test(fileName));
  if (!isImage) return undefined;

  const url = attachmentString(capture, 'url');
  if (url) return url;
  const localPath = attachmentString(capture, 'local_path');
  return localPath ? `/api/vault/media?path=${encodeURIComponent(localPath)}` : undefined;
}

function parseUrl(value: string | undefined): URL | undefined {
  if (!value) return undefined;
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function compactText(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length > 180 ? `${compact.slice(0, 180)}…` : compact;
}

function normalizeLanguage(language: string | undefined): string | undefined {
  if (!language) return undefined;
  return language === 'jsx' ? 'tsx' : language.toLowerCase();
}

function languageFromFilename(fileName: string): string | undefined {
  const extension = fileName.split('.').pop()?.toLowerCase();
  const languages: Record<string, string> = {
    cjs: 'javascript',
    go: 'go',
    js: 'javascript',
    jsx: 'tsx',
    json: 'json',
    md: 'markdown',
    mjs: 'javascript',
    py: 'python',
    rs: 'rust',
    ts: 'typescript',
    tsx: 'tsx',
    yaml: 'yaml',
    yml: 'yaml',
  };
  return extension ? languages[extension] : undefined;
}
