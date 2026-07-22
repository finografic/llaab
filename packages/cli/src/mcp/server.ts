import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getNodeFilePath, listNodes } from '@llaab/core';
import { NodeTypeSchema } from '@llaab/schemas';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { NodeType } from '@llaab/schemas';

const DEFAULT_API_URL = 'http://localhost:8888';
const MAX_DERIVED_TITLE_LENGTH = 80;
const INBOX_DEFAULT_TAGS = ['hermes', 'inbox'];

/**
 * Creates the LLAAB vault MCP server.
 *
 * Resources: llaab://vault/nodes/{id} — individual nodes as raw markdown Tools: vault_list — search/filter,
 * vault_read — full content by id, vault_capture_idea — create raw idea nodes
 */
export function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: 'llaab-vault', version: '0.0.1' },
    {
      instructions:
        'LLAAB vault: your personal knowledge base of ideas, transcripts, skills, and decisions. ' +
        'Use vault_list to search or filter nodes, vault_read to fetch full content by id.',
    },
  );

  // ── Resource template — individual vault nodes as raw markdown ────────────

  server.registerResource(
    'vault-node',
    new ResourceTemplate('llaab://vault/nodes/{id}', { list: undefined }),
    {
      description: 'A vault node (idea, transcript, skill, source, decision, etc.) as raw markdown.',
      mimeType: 'text/markdown',
    },
    async (uri, variables) => {
      const id = String(variables['id'] ?? '');
      const nodes = await listNodes();
      const node = nodes.find((n) => n.id === id);
      if (!node) return { contents: [] };

      try {
        const filePath = getNodeFilePath(node.type, node.id);
        const text = await readFile(filePath, 'utf-8');
        return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text }] };
      } catch {
        return { contents: [] };
      }
    },
  );

  // ── Tool: capture a raw idea node ─────────────────────────────────────────

  const vaultCaptureIdeaSchema = z.object({
    title: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe('Optional concise idea title. If omitted, one is derived from the body.'),
    body: z.string().trim().min(1).describe('Raw idea text to store in the vault.'),
    tags: z.array(z.string().trim().min(1)).optional().describe('Optional tags, e.g. ["d:llm", "hermes"].'),
  });

  server.registerTool(
    'vault_capture_idea',
    {
      description:
        'Capture a raw thought as a new LLAAB idea node. ' +
        'Use this for observations, suggestions, or user-provided notes that should be saved before later consolidation.',
      inputSchema: vaultCaptureIdeaSchema,
    },
    async (args: z.infer<typeof vaultCaptureIdeaSchema>) => {
      const title = args.title ?? deriveIdeaTitle(args.body);
      const result = await createIdeaNodeViaApi({ title, body: args.body, tags: args.tags });

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: result.error }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: `Captured idea node ${result.id} at ${result.path}`,
          },
        ],
      };
    },
  );

  // ── Tool: capture raw inbox item ──────────────────────────────────────────

  const vaultCaptureInboxSchema = z.object({
    raw_text: z.string().trim().optional().describe('Raw message text from the inbox surface.'),
    route_kind: z.string().trim().min(1).optional().describe('Router kind, e.g. web_link or raw.'),
    source: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Optional platform metadata such as Telegram chat_id/message_id.'),
    payload: z.record(z.string(), z.unknown()).optional().describe('Optional router payload to preserve.'),
  });

  server.registerTool(
    'vault_capture_inbox',
    {
      description:
        'Capture a raw Hermes inbox item as a LLAAB idea node. ' +
        'Use this safe fallback when no more specific inbox tool applies.',
      inputSchema: vaultCaptureInboxSchema,
    },
    async (args: z.infer<typeof vaultCaptureInboxSchema>) => {
      const body = formatInboxBody(args);
      const title = deriveIdeaTitle(args.raw_text?.trim() || args.route_kind || 'Hermes inbox item');
      const result = await createIdeaNodeViaApi({
        title,
        body,
        tags: [...INBOX_DEFAULT_TAGS, 'inbox:raw'],
      });

      if (!result.ok) {
        return errorText(result.error);
      }

      return textContent(`Captured inbox item ${result.id} at ${result.path}`);
    },
  );

  // ── Tool: capture todo note ───────────────────────────────────────────────

  const vaultCaptureTodoSchema = z.object({
    text: z.string().trim().min(1).describe('Todo text after the todo: prefix has been removed.'),
    source: z.record(z.string(), z.unknown()).optional().describe('Optional platform metadata.'),
  });

  server.registerTool(
    'vault_capture_todo',
    {
      description: 'Capture a short Hermes inbox todo as a LLAAB idea node tagged for later review.',
      inputSchema: vaultCaptureTodoSchema,
    },
    async (args: z.infer<typeof vaultCaptureTodoSchema>) => {
      const result = await createIdeaNodeViaApi({
        title: `Todo: ${deriveIdeaTitle(args.text)}`,
        body: formatInboxBody({ raw_text: args.text, route_kind: 'todo', source: args.source }),
        tags: [...INBOX_DEFAULT_TAGS, 'inbox:todo'],
      });

      if (!result.ok) {
        return errorText(result.error);
      }

      return textContent(`Captured todo ${result.id}`);
    },
  );

  // ── Tool: capture web link ────────────────────────────────────────────────

  const vaultCaptureWebLinkSchema = z.object({
    url: z.url().describe('Blog, docs, GitHub, or generic URL to preserve.'),
    kind: z.string().trim().min(1).optional().describe('Router kind, e.g. github_repo or web_link.'),
    title: z.string().trim().min(1).optional().describe('Optional human label.'),
    source: z.record(z.string(), z.unknown()).optional().describe('Optional platform metadata.'),
    payload: z.record(z.string(), z.unknown()).optional().describe('Optional router metadata.'),
  });

  server.registerTool(
    'vault_capture_web_link',
    {
      description: 'Capture a Hermes inbox web link for later article/docs/GitHub workflows.',
      inputSchema: vaultCaptureWebLinkSchema,
    },
    async (args: z.infer<typeof vaultCaptureWebLinkSchema>) => {
      const title = args.title ?? webLinkTitle(args.kind ?? 'web_link', args.url, args.payload);
      const result = await createIdeaNodeViaApi({
        title,
        body: formatInboxBody({
          raw_text: args.url,
          route_kind: args.kind ?? 'web_link',
          source: args.source,
          payload: args.payload ?? { url: args.url },
        }),
        tags: [...INBOX_DEFAULT_TAGS, ...webLinkTags(args.kind ?? 'web_link')],
      });

      if (!result.ok) {
        return errorText(result.error);
      }

      return textContent(`Captured web link ${result.id}`);
    },
  );

  // ── Tool: capture attachment metadata ─────────────────────────────────────

  const vaultCaptureAttachmentSchema = z.object({
    attachment: z.record(z.string(), z.unknown()).describe('Attachment metadata, not binary content.'),
    raw_text: z.string().trim().optional().describe('Optional caption or extracted attachment text.'),
    route_kind: z.string().trim().min(1).optional().describe('Router kind, e.g. code_attachment.'),
    source: z.record(z.string(), z.unknown()).optional().describe('Optional platform metadata.'),
  });

  server.registerTool(
    'vault_capture_attachment',
    {
      description:
        'Capture Hermes inbox attachment metadata for later file/screenshot processing. ' +
        'This tool stores metadata only, not arbitrary files.',
      inputSchema: vaultCaptureAttachmentSchema,
    },
    async (args: z.infer<typeof vaultCaptureAttachmentSchema>) => {
      const filename =
        typeof args.attachment['file_name'] === 'string' ? args.attachment['file_name'] : 'attachment';
      const routeKind = args.route_kind ?? 'attachment';
      const result = await createIdeaNodeViaApi({
        title: attachmentTitle(routeKind, filename),
        body: formatInboxBody({
          raw_text: args.raw_text,
          route_kind: routeKind,
          source: args.source,
          payload: { attachment: args.attachment },
        }),
        tags: [...INBOX_DEFAULT_TAGS, ...attachmentTags(routeKind)],
      });

      if (!result.ok) {
        return errorText(result.error);
      }

      return textContent(`Captured attachment metadata ${result.id}`);
    },
  );

  // ── Tool: trigger YouTube ingestion ───────────────────────────────────────

  const vaultIngestYouTubeSchema = z.object({
    url: z.url().describe('YouTube watch, short, or shorts URL.'),
    title: z.string().trim().min(1).optional().describe('Optional title override.'),
    tags: z.array(z.string().trim().min(1)).optional().describe('Optional vault tags.'),
    skipExtraction: z.boolean().optional().describe('Skip post-ingest idea extraction.'),
  });

  server.registerTool(
    'vault_ingest_youtube',
    {
      description: 'Start the existing LLAAB YouTube ingestion pipeline for a Hermes inbox URL.',
      inputSchema: vaultIngestYouTubeSchema,
    },
    async (args: z.infer<typeof vaultIngestYouTubeSchema>) => {
      const result = await postJsonViaApi('/api/ingest/youtube', {
        url: args.url,
        title: args.title,
        tags: args.tags ?? INBOX_DEFAULT_TAGS,
        skipExtraction: args.skipExtraction,
      });

      if (!result.ok) {
        return errorText(result.error);
      }

      const ingestResult = asRecord(result.data['result']);
      const id = typeof ingestResult?.['id'] === 'string' ? ingestResult['id'] : undefined;
      const reused = ingestResult?.['reused'] === true ? ' (reused existing transcript)' : '';

      return textContent(id ? `Queued YouTube ingest ${id}${reused}` : 'Queued YouTube ingest');
    },
  );

  // ── Tool: trigger podcast ingestion ───────────────────────────────────────

  const vaultIngestPodcastSchema = z.object({
    url: z.url().describe('Pocket Casts episode share URL, e.g. https://pca.st/episode/<uuid>.'),
    title: z.string().trim().min(1).optional().describe('Optional title override.'),
    tags: z.array(z.string().trim().min(1)).optional().describe('Optional vault tags.'),
    skipExtraction: z.boolean().optional().describe('Skip post-ingest idea extraction.'),
  });

  server.registerTool(
    'vault_ingest_podcast',
    {
      description:
        'Start the LLAAB podcast ingestion pipeline for a Pocket Casts episode link. Resolves the ' +
        "show's RSS feed, matches the episode, and uses its published transcript or transcribes " +
        'the audio locally.',
      inputSchema: vaultIngestPodcastSchema,
    },
    async (args: z.infer<typeof vaultIngestPodcastSchema>) => {
      const result = await postJsonViaApi('/api/ingest/podcast', {
        url: args.url,
        title: args.title,
        tags: args.tags ?? INBOX_DEFAULT_TAGS,
        skipExtraction: args.skipExtraction,
      });

      if (!result.ok) {
        return errorText(result.error);
      }

      const ingestResult = asRecord(result.data['result']);
      const id = typeof ingestResult?.['id'] === 'string' ? ingestResult['id'] : undefined;
      const reused = ingestResult?.['reused'] === true ? ' (reused existing transcript)' : '';

      return textContent(id ? `Queued podcast ingest ${id}${reused}` : 'Queued podcast ingest');
    },
  );

  // ── Tool: pin npm package ─────────────────────────────────────────────────

  const vaultPinPackageSchema = z.object({
    name: z.string().trim().min(1).describe('npm package name, e.g. @modelcontextprotocol/sdk'),
  });

  async function pinPackageFromTool(args: z.infer<typeof vaultPinPackageSchema>) {
    const result = await postJsonViaApi('/api/registry/pins', { name: args.name });

    if (!result.ok) {
      if (result.status === 409) {
        return textContent(`Pinned package ${args.name} (already pinned)`);
      }

      return errorText(result.error);
    }

    const pin = asRecord(result.data['pin']);
    const name = typeof pin?.['name'] === 'string' ? pin['name'] : args.name;

    return textContent(`Pinned package ${name}`);
  }

  server.registerTool(
    'vault_pin_package',
    {
      description: 'Pin an npm package in the LLAAB registry package list.',
      inputSchema: vaultPinPackageSchema,
    },
    pinPackageFromTool,
  );

  server.registerTool(
    'vault_pin_library',
    {
      description: 'Deprecated alias for vault_pin_package.',
      inputSchema: vaultPinPackageSchema,
    },
    pinPackageFromTool,
  );

  // ── Tool: pin GitHub repository ───────────────────────────────────────────

  const vaultPinRepositorySchema = z.object({
    fullName: z
      .string()
      .trim()
      .min(3)
      .regex(/^[^/]+\/[^/]+$/u)
      .describe('GitHub repo name, e.g. owner/repo'),
  });

  server.registerTool(
    'vault_pin_repository',
    {
      description: 'Pin a GitHub repository in the LLAAB registry repository list.',
      inputSchema: vaultPinRepositorySchema,
    },
    async (args: z.infer<typeof vaultPinRepositorySchema>) => {
      const result = await postJsonViaApi('/api/registry/repo-pins', { fullName: args.fullName });

      if (!result.ok) {
        if (result.status === 409) {
          return textContent(`Pinned repository ${args.fullName} (already pinned)`);
        }

        return errorText(result.error);
      }

      const pin = asRecord(result.data['pin']);
      const fullName = typeof pin?.['fullName'] === 'string' ? pin['fullName'] : args.fullName;

      return textContent(`Pinned repository ${fullName}`);
    },
  );

  // ── Tool: list / search nodes ─────────────────────────────────────────────

  const vaultListSchema = z.object({
    type: NodeTypeSchema.optional().describe(
      'Node type: idea | transcript | skill | prompt | instruction | resource | source | decision | run',
    ),
    search: z.string().optional().describe('Text search across title and body'),
    tags: z.array(z.string()).optional().describe('Filter by tags, e.g. ["d:llm", "d:infra"]'),
    limit: z.number().int().min(1).max(50).optional().describe('Max results (default 20)'),
  });

  server.registerTool(
    'vault_list',
    {
      description:
        'List vault nodes with optional filters. Returns compact summaries (id, type, title, tags, status, created_at). ' +
        'Use search for text matching, type to filter by node kind, tags for domain tags (e.g. d:llm).',
      inputSchema: vaultListSchema,
    },
    async (args: z.infer<typeof vaultListSchema>) => {
      const { type, search, tags, limit } = args;
      const nodes = await listNodes({ type: type as NodeType | undefined, search, tags, limit: limit ?? 20 });
      const summaries = nodes.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        tags: n.tags,
        status: n.status,
        created_at: n.created_at,
      }));
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(summaries, null, 2) }],
      };
    },
  );

  // ── Tool: read full node content ──────────────────────────────────────────

  const vaultReadSchema = z.object({
    id: z.string().describe('Node id, e.g. "idea.my-idea-2026-04-16T120000"'),
  });

  server.registerTool(
    'vault_read',
    {
      description:
        'Read the full raw markdown of a vault node by id. ' +
        'Use vault_list first to find node ids, then vault_read for full content.',
      inputSchema: vaultReadSchema,
    },
    async (args: z.infer<typeof vaultReadSchema>) => {
      const { id } = args;
      const nodes = await listNodes();
      const node = nodes.find((n) => n.id === id);
      if (!node) {
        return {
          content: [{ type: 'text' as const, text: `Node not found: ${id}` }],
          isError: true,
        };
      }

      try {
        const filePath = getNodeFilePath(node.type, node.id);
        const text = await readFile(filePath, 'utf-8');
        return { content: [{ type: 'text' as const, text }] };
      } catch {
        return {
          content: [{ type: 'text' as const, text: `Could not read node file: ${id}` }],
          isError: true,
        };
      }
    },
  );

  return server;
}

function webLinkTitle(routeKind: string, url: string, payload: Record<string, unknown> | undefined): string {
  if (routeKind === 'github_repo') {
    const owner = typeof payload?.['owner'] === 'string' ? payload['owner'] : undefined;
    const repo = typeof payload?.['repo'] === 'string' ? payload['repo'] : undefined;
    return owner && repo ? `GitHub repo: ${owner}/${repo}` : `GitHub repo: ${new URL(url).hostname}`;
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

function webLinkAddress(url: string): string {
  const parsed = new URL(url);
  const pathname = parsed.pathname.replace(/\/+$/u, '');
  return pathname ? `${parsed.hostname}${pathname}` : parsed.hostname;
}

interface CreateIdeaNodeRequest {
  title: string;
  body: string;
  tags?: string[];
}

interface CaptureInboxArgs {
  raw_text?: string;
  route_kind?: string;
  source?: Record<string, unknown>;
  payload?: Record<string, unknown>;
}

type ApiJsonResult =
  | { ok: true; data: Record<string, unknown>; status: number }
  | { ok: false; error: string; status?: number };
type CreateIdeaNodeResult = { ok: true; id: string; path: string } | { ok: false; error: string };

async function createIdeaNodeViaApi(input: CreateIdeaNodeRequest): Promise<CreateIdeaNodeResult> {
  const result = await postJsonViaApi('/api/vault/nodes', {
    type: 'idea',
    title: input.title,
    body: input.body,
    tags: input.tags,
  });

  if (!result.ok) {
    return { ok: false, error: result.error.replace('Request failed', 'Failed to capture idea') };
  }

  const id = result.data['id'];
  const path = result.data['path'];
  if (typeof id !== 'string' || typeof path !== 'string') {
    return { ok: false, error: 'Failed to capture idea: unexpected API response.' };
  }

  return { ok: true, id, path };
}

async function postJsonViaApi(path: string, body: Record<string, unknown>): Promise<ApiJsonResult> {
  const apiKey = resolveEnvValue('LLAAB_API_KEY');
  if (!apiKey) {
    return { ok: false, error: 'LLAAB_API_KEY is required for LLAAB MCP write tools.' };
  }

  const apiUrl = (resolveEnvValue('LLAAB_API_URL') || DEFAULT_API_URL).replace(/\/+$/, '');

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
      return { ok: false, error: `Request failed (${response.status}): ${error}`, status: response.status };
    }

    if (!parsed) {
      return { ok: false, error: 'Request failed: unexpected API response.' };
    }

    return { ok: true, data: parsed, status: response.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { ok: false, error: `Request failed: ${message}` };
  }
}

function formatInboxBody(args: CaptureInboxArgs): string {
  const parts = ['# Hermes Inbox Item'];

  if (args.raw_text?.trim()) {
    parts.push('', args.raw_text.trim());
  }

  const metadata = {
    route_kind: args.route_kind,
    source: args.source,
    payload: args.payload,
  };

  parts.push('', '```json', JSON.stringify(metadata, null, 2), '```');

  return parts.join('\n');
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return undefined;
}

function textContent(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function errorText(text: string) {
  return { content: [{ type: 'text' as const, text }], isError: true };
}

function deriveIdeaTitle(body: string): string {
  const firstLine = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  const fallback = firstLine ?? body.trim();
  const sentence = fallback.match(/^(.+?[.!?])(?:\s|$)/u)?.[1] ?? fallback;
  const compact = sentence.replace(/\s+/g, ' ').trim();

  if (compact.length <= MAX_DERIVED_TITLE_LENGTH) return compact;
  return `${compact.slice(0, MAX_DERIVED_TITLE_LENGTH - 3).trimEnd()}...`;
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
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
  const llaabRepo = process.env['LLAAB_REPO_DIR'] ?? (home ? join(home, 'LLAAB') : undefined);

  return [
    join(process.cwd(), '.env'),
    ...(llaabRepo ? [join(llaabRepo, '.env')] : []),
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
