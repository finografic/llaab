import { readFile } from 'node:fs/promises';
import { getNodeFilePath, listNodes } from '@llaab/core';
import { NodeTypeSchema } from '@llaab/schemas';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { NodeType } from '@llaab/schemas';

/**
 * Creates the LLAAB vault MCP server.
 *
 * Resources: llaab://vault/nodes/{id} — individual nodes as raw markdown Tools: vault_list — search/filter,
 * vault_read — full content by id
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
