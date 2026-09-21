import { pathToFileURL } from 'node:url';
import { Server, type CallToolRequestParams, type CallToolResult, type Tool } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';

export const fakeTools: Tool[] = [{
  name: 'echo', description: 'Echo a text value',
  inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false },
}];
export function createFakeMcpServer(options: { result?: CallToolResult; error?: Error } = {}) {
  const calls: CallToolRequestParams[] = [];
  const server = new Server({ name: 'fake-upstream', version: '0.1.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler('tools/list', () => ({ tools: structuredClone(fakeTools) }));
  server.setRequestHandler('tools/call', request => {
    calls.push(structuredClone(request.params));
    if (options.error) throw options.error;
    return options.result ?? { content: [{ type: 'text', text: String(request.params.arguments?.text) }] };
  });
  return { server, calls, options };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  serveStdio(() => createFakeMcpServer().server);
}
