import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createHermesInboxLogEvent,
  createHermesInboxReceipt,
  createHermesInboxToolCall,
  routeHermesInboxItem,
  routeHermesInboxText,
} from '@llaab/core';
import { defineCommand } from 'citty';
import type {
  HermesInboxAttachment,
  HermesInboxAttachmentKind,
  HermesInboxExecutionResult,
  HermesInboxItem,
  HermesInboxPlatform,
  HermesInboxToolCall,
} from '@llaab/schemas';

const DEFAULT_API_URL = 'http://localhost:8888';
const MAX_DERIVED_TITLE_LENGTH = 80;
const INBOX_DEFAULT_TAGS = ['hermes', 'inbox'];

export const inboxCommand = defineCommand({
  meta: {
    name: 'inbox',
    description: 'Route and execute one Hermes dropbox inbox message.',
  },
  args: {
    text: {
      type: 'positional',
      description: 'Bare inbox text, URL, or todo note.',
      required: false,
    },
    rawText: {
      type: 'string',
      description: 'Bare inbox text, URL, todo note, or attachment caption.',
      alias: 'raw-text',
    },
    platform: {
      type: 'string',
      description: 'Source platform metadata (telegram, discord, manual, unknown).',
      default: 'manual',
    },
    user: {
      type: 'string',
      description: 'Optional source user id.',
    },
    chat: {
      type: 'string',
      description: 'Optional source chat id.',
    },
    message: {
      type: 'string',
      description: 'Optional source message id.',
    },
    json: {
      type: 'boolean',
      description: 'Print structured route/tool/receipt event JSON.',
      default: false,
    },
    dryRun: {
      type: 'boolean',
      description: 'Route and plan without calling LLAAB write APIs.',
      default: false,
      alias: 'dry-run',
    },
    skipExtraction: {
      type: 'boolean',
      description: 'Skip post-ingest extraction for YouTube routes.',
      default: false,
      alias: 'skip-extraction',
    },
    attachmentPath: {
      type: 'string',
      description: 'Local cached attachment path from the messaging bridge.',
      alias: 'attachment-path',
    },
    attachmentName: {
      type: 'string',
      description: 'Original or cached attachment filename.',
      alias: 'attachment-name',
    },
    attachmentMime: {
      type: 'string',
      description: 'Attachment MIME type.',
      alias: 'attachment-mime',
    },
    attachmentKind: {
      type: 'string',
      description: 'Attachment kind: image, file, or unknown.',
      alias: 'attachment-kind',
    },
    attachmentSize: {
      type: 'string',
      description: 'Attachment size in bytes.',
      alias: 'attachment-size',
    },
  },
  async run({ args }) {
    const platform = parsePlatform(optionValue(args, 'platform', 'platform'));
    const text = (optionValue(args, 'rawText', 'raw-text') ?? args.text)?.trim();
    const attachment = buildAttachment({
      kind: optionValue(args, 'attachmentKind', 'attachment-kind'),
      name: optionValue(args, 'attachmentName', 'attachment-name'),
      mime: optionValue(args, 'attachmentMime', 'attachment-mime'),
      path: optionValue(args, 'attachmentPath', 'attachment-path'),
      size: optionValue(args, 'attachmentSize', 'attachment-size'),
    });

    if (!text && !attachment) {
      throw new Error('Provide inbox text or attachment metadata.');
    }

    const item: HermesInboxItem = {
      raw_text: text,
      source: {
        platform,
        user_id: optionValue(args, 'user', 'user'),
        chat_id: optionValue(args, 'chat', 'chat'),
        message_id: optionValue(args, 'message', 'message'),
        timestamp: new Date().toISOString(),
      },
      attachments: attachment ? [attachment] : [],
      received_at: new Date().toISOString(),
    };

    const route = attachment ? routeHermesInboxItem(item) : routeHermesInboxText(text ?? '');
    const toolCall = createHermesInboxToolCall(route, item);

    if (toolCall.name === 'vault_ingest_youtube' && args.skipExtraction) {
      toolCall.arguments['skipExtraction'] = true;
    }

    const result = args.dryRun
      ? ({ status: 'saved', target_label: `${toolCall.name} dry run` } satisfies HermesInboxExecutionResult)
      : await executeInboxToolCall(toolCall);
    const receipt = createHermesInboxReceipt(route, result);
    const event = createHermesInboxLogEvent({ route, toolCall, receipt, result });

    if (args.json) {
      console.log(JSON.stringify(event, null, 2));
      return;
    }

    console.log(receipt.text);
  },
});

async function executeInboxToolCall(toolCall: HermesInboxToolCall): Promise<HermesInboxExecutionResult> {
  switch (toolCall.name) {
    case 'vault_ingest_youtube':
      return executeYouTubeIngest(toolCall);
    case 'vault_pin_library':
      return executeLibraryPin(toolCall);
    case 'vault_capture_todo':
    case 'vault_capture_web_link':
    case 'vault_capture_attachment':
    case 'vault_capture_inbox':
      return executeIdeaCapture(toolCall);
  }
}

async function executeYouTubeIngest(toolCall: HermesInboxToolCall): Promise<HermesInboxExecutionResult> {
  const result = await postJsonViaApi('/api/ingest/youtube', {
    url: stringArg(toolCall, 'url'),
    tags: arrayArg(toolCall, 'tags') ?? INBOX_DEFAULT_TAGS,
    skipExtraction: booleanArg(toolCall, 'skipExtraction'),
  });

  if (!result.ok) {
    return { status: 'failed', error: result.error };
  }

  const ingestResult = asRecord(result.data['result']);
  const id = typeof ingestResult?.['id'] === 'string' ? ingestResult['id'] : undefined;
  const reused = ingestResult?.['reused'] === true ? ' (reused existing transcript)' : '';

  return { status: 'queued', target_id: id, target_label: id ? `${id}${reused}` : undefined };
}

async function executeLibraryPin(toolCall: HermesInboxToolCall): Promise<HermesInboxExecutionResult> {
  const name = stringArg(toolCall, 'name');
  const result = await postJsonViaApi('/api/registry/pins', { name });

  if (!result.ok) {
    if (result.status === 409) {
      return { status: 'pinned', target_label: `${name} (already pinned)` };
    }

    return { status: 'failed', error: result.error };
  }

  const pin = asRecord(result.data['pin']);
  const pinnedName = typeof pin?.['name'] === 'string' ? pin['name'] : name;

  return { status: 'pinned', target_label: pinnedName };
}

async function executeIdeaCapture(toolCall: HermesInboxToolCall): Promise<HermesInboxExecutionResult> {
  const capture = buildIdeaCapture(toolCall);
  const result = await postJsonViaApi('/api/vault/nodes', {
    type: 'idea',
    title: capture.title,
    body: capture.body,
    tags: capture.tags,
  });

  if (!result.ok) {
    if (result.status === 409) {
      return { status: 'saved', target_label: `${capture.title} (already exists)` };
    }

    return { status: 'failed', error: result.error };
  }

  const id = typeof result.data['id'] === 'string' ? result.data['id'] : undefined;

  return { status: 'saved', target_id: id };
}

function buildIdeaCapture(toolCall: HermesInboxToolCall): { title: string; body: string; tags: string[] } {
  switch (toolCall.name) {
    case 'vault_capture_todo': {
      const text = stringArg(toolCall, 'text');
      return {
        title: `Todo: ${deriveTitle(text)}`,
        body: formatInboxBody({ raw_text: text, route_kind: 'todo', source: recordArg(toolCall, 'source') }),
        tags: [...INBOX_DEFAULT_TAGS, 'inbox:todo'],
      };
    }
    case 'vault_capture_web_link': {
      const url = stringArg(toolCall, 'url');
      const routeKind = stringArg(toolCall, 'kind') || 'web_link';
      return {
        title: webLinkTitle(routeKind, url, recordArg(toolCall, 'payload')),
        body: formatInboxBody({
          raw_text: url,
          route_kind: routeKind,
          source: recordArg(toolCall, 'source'),
          payload: recordArg(toolCall, 'payload') ?? { url },
        }),
        tags: [...INBOX_DEFAULT_TAGS, ...webLinkTags(routeKind)],
      };
    }
    case 'vault_capture_attachment': {
      const attachment = recordArg(toolCall, 'attachment') ?? {};
      const filename = typeof attachment['file_name'] === 'string' ? attachment['file_name'] : 'attachment';
      const rawText = stringArg(toolCall, 'raw_text');
      const routeKind = stringArg(toolCall, 'route_kind') || 'attachment';
      return {
        title: attachmentTitle(routeKind, filename),
        body: formatInboxBody({
          raw_text: rawText,
          route_kind: routeKind,
          source: recordArg(toolCall, 'source'),
          payload: { attachment },
        }),
        tags: [...INBOX_DEFAULT_TAGS, ...attachmentTags(routeKind)],
      };
    }
    case 'vault_capture_inbox':
      return inboxCapture(stringArg(toolCall, 'route_kind') || 'raw', {
        rawText: stringArg(toolCall, 'raw_text'),
        source: recordArg(toolCall, 'source'),
        payload: recordArg(toolCall, 'payload'),
      });
    case 'vault_ingest_youtube':
    case 'vault_pin_library':
      throw new Error(`Unsupported idea capture tool: ${toolCall.name}`);
  }
}

function inboxCapture(
  routeKind: string,
  input: {
    rawText: string;
    source?: Record<string, unknown>;
    payload?: Record<string, unknown>;
  },
): { title: string; body: string; tags: string[] } {
  if (routeKind === 'code_snippet') {
    return {
      title: `Code snippet: ${deriveTitle(input.rawText || 'snippet')}`,
      body: formatInboxBody({
        raw_text: input.rawText,
        route_kind: routeKind,
        source: input.source,
        payload: input.payload,
      }),
      tags: [...INBOX_DEFAULT_TAGS, 'inbox:code', 'inbox:snippet'],
    };
  }

  return {
    title: deriveTitle(input.rawText || routeKind || 'Hermes inbox item'),
    body: formatInboxBody({
      raw_text: input.rawText,
      route_kind: routeKind,
      source: input.source,
      payload: input.payload,
    }),
    tags: [...INBOX_DEFAULT_TAGS, 'inbox:raw'],
  };
}

function attachmentTitle(routeKind: string, filename: string): string {
  if (routeKind === 'image') {
    return `Inbox image: ${filename}`;
  }

  if (routeKind === 'code_attachment') {
    return `Code attachment: ${filename}`;
  }

  if (routeKind === 'docs_attachment') {
    return `Docs attachment: ${filename}`;
  }

  return `Inbox attachment: ${filename}`;
}

function attachmentTags(routeKind: string): string[] {
  if (routeKind === 'image') {
    return ['inbox:image'];
  }

  if (routeKind === 'code_attachment') {
    return ['inbox:attachment', 'inbox:code'];
  }

  if (routeKind === 'docs_attachment') {
    return ['inbox:attachment', 'inbox:docs'];
  }

  return ['inbox:attachment'];
}

function webLinkTitle(routeKind: string, url: string, payload: Record<string, unknown> | undefined): string {
  if (routeKind === 'github_repo') {
    const owner = typeof payload?.['owner'] === 'string' ? payload['owner'] : undefined;
    const repo = typeof payload?.['repo'] === 'string' ? payload['repo'] : undefined;
    return owner && repo ? `GitHub repo: ${owner}/${repo}` : `GitHub repo: ${safeHostname(url)}`;
  }

  if (routeKind === 'docs_link') {
    return `Docs link: ${webLinkAddress(url)}`;
  }

  if (routeKind === 'post_link') {
    return `Post link: ${webLinkAddress(url)}`;
  }

  if (routeKind === 'code_link') {
    return `Code link: ${webLinkAddress(url)}`;
  }

  return `Inbox link: ${webLinkAddress(url)}`;
}

function webLinkTags(routeKind: string): string[] {
  switch (routeKind) {
    case 'github_repo':
      return ['inbox:link', 'inbox:github'];
    case 'docs_link':
      return ['inbox:link', 'inbox:docs'];
    case 'post_link':
      return ['inbox:link', 'inbox:post'];
    case 'code_link':
      return ['inbox:link', 'inbox:code'];
    default:
      return ['inbox:link'];
  }
}

type ApiJsonResult =
  | { ok: true; data: Record<string, unknown>; status: number }
  | { ok: false; error: string; status?: number };

async function postJsonViaApi(path: string, body: Record<string, unknown>): Promise<ApiJsonResult> {
  const apiKey = resolveEnvValue('LLAAB_API_KEY');
  if (!apiKey) {
    return { ok: false, error: 'LLAAB_API_KEY is required' };
  }

  const apiUrl = (resolveEnvValue('LLAAB_API_URL') || DEFAULT_API_URL).replace(/\/+$/u, '');

  try {
    const response = await fetch(`${apiUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    const parsed = parseJsonObject(responseText);

    if (!response.ok) {
      const error = typeof parsed?.['error'] === 'string' ? parsed['error'] : responseText;
      return { ok: false, error, status: response.status };
    }

    if (!parsed) {
      return { ok: false, error: 'Unexpected API response.', status: response.status };
    }

    return { ok: true, data: parsed, status: response.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { ok: false, error: message };
  }
}

function formatInboxBody(input: {
  raw_text?: string;
  route_kind?: string;
  source?: Record<string, unknown>;
  payload?: Record<string, unknown>;
}): string {
  const parts = ['# Hermes Inbox Item'];

  if (input.raw_text?.trim()) {
    parts.push('', input.raw_text.trim());
  }

  parts.push(
    '',
    '```json',
    JSON.stringify(
      {
        route_kind: input.route_kind,
        source: input.source,
        payload: input.payload,
      },
      null,
      2,
    ),
    '```',
  );

  return parts.join('\n');
}

function deriveTitle(text: string): string {
  const firstLine = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find(Boolean);
  const compact = (firstLine ?? text.trim()).replace(/\s+/gu, ' ').trim();

  if (compact.length <= MAX_DERIVED_TITLE_LENGTH) return compact;
  return `${compact.slice(0, MAX_DERIVED_TITLE_LENGTH - 3).trimEnd()}...`;
}

function parsePlatform(value: unknown): HermesInboxPlatform {
  return value === 'telegram' || value === 'discord' || value === 'manual' || value === 'unknown'
    ? value
    : 'unknown';
}

function optionValue(args: Record<string, unknown>, key: string, flagName: string): string | undefined {
  return optionString(args[key], flagName) ?? optionString(args[flagName], flagName);
}

function optionString(value: unknown, name: string): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  return processArgValue(`--${name}`);
}

function processArgValue(flag: string): string | undefined {
  const equalsPrefix = `${flag}=`;

  for (let index = 0; index < process.argv.length; index += 1) {
    const arg = process.argv[index];

    if (arg === flag) {
      const next = process.argv[index + 1];
      return next && !next.startsWith('-') ? next : undefined;
    }

    if (arg?.startsWith(equalsPrefix)) {
      return arg.slice(equalsPrefix.length);
    }
  }

  return undefined;
}

function buildAttachment(input: {
  kind?: string;
  name?: string;
  mime?: string;
  path?: string;
  size?: string;
}): HermesInboxAttachment | undefined {
  const localPath = input.path?.trim();
  const fileName = input.name?.trim() || deriveFilename(localPath);
  const mimeType = input.mime?.trim();
  const sizeBytes = parseOptionalNonnegativeInteger(input.size);

  if (!localPath && !fileName && !mimeType && sizeBytes === undefined) {
    return undefined;
  }

  return {
    kind: parseAttachmentKind(input.kind, mimeType),
    file_name: fileName,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    local_path: localPath,
  };
}

function parseAttachmentKind(value: unknown, mimeType?: string): HermesInboxAttachmentKind {
  if (value === 'image' || value === 'file' || value === 'unknown') {
    return value;
  }

  if (mimeType?.startsWith('image/')) {
    return 'image';
  }

  return 'file';
}

function parseOptionalNonnegativeInteger(value: unknown): number | undefined {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function deriveFilename(path: string | undefined): string | undefined {
  if (!path) {
    return undefined;
  }

  const parts = path.split(/[\\/]/u).filter(Boolean);

  return parts.at(-1);
}

function stringArg(toolCall: HermesInboxToolCall, key: string): string {
  const value = toolCall.arguments[key];

  return typeof value === 'string' ? value : '';
}

function booleanArg(toolCall: HermesInboxToolCall, key: string): boolean | undefined {
  const value = toolCall.arguments[key];

  return typeof value === 'boolean' ? value : undefined;
}

function arrayArg(toolCall: HermesInboxToolCall, key: string): unknown[] | undefined {
  const value = toolCall.arguments[key];

  return Array.isArray(value) ? value : undefined;
}

function recordArg(toolCall: HermesInboxToolCall, key: string): Record<string, unknown> | undefined {
  return asRecord(toolCall.arguments[key]);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return undefined;
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return asRecord(value) ?? null;
  } catch {
    return null;
  }
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'web link';
  }
}

function webLinkAddress(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.replace(/\/+$/u, '');
    return pathname ? `${parsed.hostname}${pathname}` : parsed.hostname;
  } catch {
    return 'web link';
  }
}

function resolveEnvValue(name: string): string | undefined {
  const direct = process.env[name]?.trim();

  if (direct) {
    return direct;
  }

  for (const path of envFileCandidates()) {
    const value = readEnvFileValue(path, name);

    if (value) {
      return value;
    }
  }

  return undefined;
}

function envFileCandidates(): string[] {
  const home = process.env['HOME'];

  return [
    join(process.cwd(), '.env'),
    '/Users/justin/LLAAB/.env',
    ...(home ? [join(home, '.hermes', '.env')] : []),
  ];
}

function readEnvFileValue(path: string, name: string): string | undefined {
  if (!existsSync(path)) {
    return undefined;
  }

  const prefix = `${name}=`;

  for (const line of readFileSync(path, 'utf-8').split(/\r?\n/u)) {
    if (!line.startsWith(prefix)) {
      continue;
    }

    return (
      line
        .slice(prefix.length)
        .trim()
        .replace(/^["']|["']$/gu, '') || undefined
    );
  }

  return undefined;
}
