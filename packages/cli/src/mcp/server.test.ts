import { describe, expect, it } from 'vitest';

import { createMcpServer } from './server.js';

/** Registered tools are held on the underlying server instance keyed by tool name. */
function registeredToolNames(): string[] {
  const server = createMcpServer() as unknown as { _registeredTools: Record<string, unknown> };
  return Object.keys(server._registeredTools ?? {});
}

describe('MCP tool surface', () => {
  it('exposes vault_ingest_article alongside the other ingest tools', () => {
    const names = registeredToolNames();

    expect(names).toContain('vault_ingest_article');
    expect(names).toContain('vault_ingest_youtube');
    expect(names).toContain('vault_ingest_podcast');
  });

  it('describes vault_ingest_article with its url input and scope limits', () => {
    const server = createMcpServer() as unknown as {
      _registeredTools: Record<string, { description?: string; inputSchema?: unknown }>;
    };
    const tool = server._registeredTools['vault_ingest_article'];

    expect(tool).toBeDefined();
    expect(tool?.description).toContain('article');
    // The tool must not imply it handles formats the pipeline explicitly rejects.
    expect(tool?.description).toContain('PDF');
    expect(tool?.inputSchema).toBeDefined();
  });
});
