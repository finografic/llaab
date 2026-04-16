import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { defineCommand } from 'citty';

import { createMcpServer } from '../mcp/server.js';

export const mcpCommand = defineCommand({
  meta: {
    name: 'mcp',
    description: 'Start the LLAAB vault MCP server over stdio.',
  },
  async run() {
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // Process stays alive — StdioServerTransport owns the lifecycle.
    // Claude Code (or any MCP client) terminates the process when done.
  },
});
