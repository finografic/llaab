import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createHermesInboxLogEvent,
  createHermesInboxReceipt,
  createHermesInboxToolCall,
  routeHermesInboxText,
} from '@llaab/core';
import { defineCommand } from 'citty';
import type {
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
      required: true,
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
  },
  async run({ args }) {
    const platform = parsePlatform(args.platform);
    const item: HermesInboxItem = {
      raw_text: args.text,
      source: {
        platform,
        user_id: args.user,
        chat_id: args.chat,
        message_id: args.message,
        timestamp: new Date().toISOString(),
      },
      attachments: [],
      received_at: new Date().toISOString(),
    };

    const route = routeHermesInboxText(args.text);
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
      return {
        title: `Inbox link: ${safeHostname(url)}`,
        body: formatInboxBody({
          raw_text: url,
          route_kind: stringArg(toolCall, 'kind') || 'web_link',
          source: recordArg(toolCall, 'source'),
          payload: recordArg(toolCall, 'payload') ?? { url },
        }),
        tags: [...INBOX_DEFAULT_TAGS, 'inbox:link'],
      };
    }
    case 'vault_capture_attachment': {
      const attachment = recordArg(toolCall, 'attachment') ?? {};
      const filename = typeof attachment['file_name'] === 'string' ? attachment['file_name'] : 'attachment';
      return {
        title: `Inbox attachment: ${filename}`,
        body: formatInboxBody({
          route_kind: 'attachment',
          source: recordArg(toolCall, 'source'),
          payload: { attachment },
        }),
        tags: [...INBOX_DEFAULT_TAGS, 'inbox:attachment'],
      };
    }
    case 'vault_capture_inbox':
      return {
        title: deriveTitle(
          stringArg(toolCall, 'raw_text') || stringArg(toolCall, 'route_kind') || 'Hermes inbox item',
        ),
        body: formatInboxBody({
          raw_text: stringArg(toolCall, 'raw_text'),
          route_kind: stringArg(toolCall, 'route_kind') || 'raw',
          source: recordArg(toolCall, 'source'),
          payload: recordArg(toolCall, 'payload'),
        }),
        tags: [...INBOX_DEFAULT_TAGS, 'inbox:raw'],
      };
    case 'vault_ingest_youtube':
    case 'vault_pin_library':
      throw new Error(`Unsupported idea capture tool: ${toolCall.name}`);
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
