import { Server } from '@modelcontextprotocol/server';
import type { ToolCatalog } from './toolCatalog.js';
import type { ToolRouter } from './router.js';

export function createGatewayServer(catalog: ToolCatalog, route: ToolRouter): Server {
  const server = new Server({ name: 'jev-mcp-middleware', version: '0.1.0' }, { capabilities: { tools: { listChanged: false } } });
  server.setRequestHandler('tools/list', () => ({ tools: catalog.list() }));
  server.setRequestHandler('tools/call', (request, context) => route(request.params, context.mcpReq.signal));
  return server;
}
