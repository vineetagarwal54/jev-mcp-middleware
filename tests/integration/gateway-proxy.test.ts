import { expect, it } from 'vitest';
import { Client, InMemoryTransport, ProtocolError } from '@modelcontextprotocol/client';
import { createFakeMcpServer, fakeTools } from '../fixtures/fakeMcpServer.js';
import { UpstreamClient } from '../../src/mcp/upstreamClient.js';
import { ToolCatalog } from '../../src/mcp/toolCatalog.js';
import { createRouter } from '../../src/mcp/router.js';
import { createGatewayServer } from '../../src/mcp/gatewayServer.js';
import type { AuditEvent } from '../../src/audit/AuditEvent.js';
import { Server, type Tool } from '@modelcontextprotocol/server';

it('proxies a fixed catalog and unchanged calls/results, rejects bad arguments, and captures upstream failures', async () => {
  const result = { content: [{ type: 'text' as const, text: 'unchanged' }], isError: false, _meta: { custom: 'retained' } };
  const fake = createFakeMcpServer({ result });
  const [upstreamTransport, fakeTransport] = InMemoryTransport.createLinkedPair();
  await fake.server.connect(fakeTransport);
  const upstream = new UpstreamClient(2000);
  const host = new Client({ name: 'test-host', version: '1' });
  const events: AuditEvent[] = [];
  let gateway: ReturnType<typeof createGatewayServer> | undefined;
  try {
    await upstream.connect(upstreamTransport);
    const catalog = new ToolCatalog(await upstream.listTools());
    gateway = createGatewayServer(catalog, createRouter({ upstream, catalog, configurationId: 'a'.repeat(64), audit: event => events.push(event) }));
    const [hostTransport, gatewayTransport] = InMemoryTransport.createLinkedPair();
    await gateway.connect(gatewayTransport);
    await host.connect(hostTransport);
    expect((await host.listTools()).tools).toEqual(fakeTools);
    const params = { name: 'echo', arguments: { text: 'Bearer private-input' } };
    expect(await host.callTool(params)).toEqual(result);
    expect(fake.calls).toEqual([params]);
    expect(await host.callTool({ name: 'echo', arguments: { text: 42 } })).toMatchObject({ isError: true });
    expect(await host.callTool({ name: 'missing', arguments: {} })).toMatchObject({ isError: true });
    expect(fake.calls).toHaveLength(1);
    fake.options.result = { content: [{ type: 'text', text: 'tool-level error' }], isError: true };
    expect(await host.callTool(params)).toEqual(fake.options.result);
    fake.options.error = new ProtocolError(-32603, 'secret upstream diagnostic');
    expect(await host.callTool(params)).toEqual({ isError: true, content: [{ type: 'text', text: 'Upstream call failed.' }] });
    expect(fake.calls).toHaveLength(3);
    expect(events.map(e => e.upstreamOutcome.status)).toEqual(['SUCCESS', 'NOT_ATTEMPTED', 'NOT_ATTEMPTED', 'TOOL_ERROR', 'PROTOCOL_ERROR']);
    expect(new Set(events.map(e => e.correlationId)).size).toBe(5);
    expect(JSON.stringify(events)).not.toMatch(/private-input|secret upstream diagnostic/);
  } finally { await host.close(); await gateway?.close(); await upstream.close(); await fake.server.close(); }
});

it('exposes every upstream tool page in order beyond the SDK aggregate limit', async () => {
  const tools: Tool[] = Array.from({ length: 65 }, (_, index) => ({
    ...fakeTools[0]!, name: `echo-${index}`,
  }));
  const cursors: Array<string | undefined> = [];
  const fake = new Server({ name: 'paged-upstream', version: '1' }, { capabilities: { tools: {} } });
  fake.setRequestHandler('tools/list', request => {
    const cursor = request.params?.cursor;
    cursors.push(cursor);
    const index = cursor === undefined ? 0 : Number(cursor);
    return { tools: [tools[index]!], ...(index + 1 < tools.length ? { nextCursor: String(index + 1) } : {}) };
  });
  fake.setRequestHandler('tools/call', () => ({ content: [{ type: 'text', text: 'ok' }] }));
  const [upstreamTransport, fakeTransport] = InMemoryTransport.createLinkedPair();
  const upstream = new UpstreamClient(2000);
  const host = new Client({ name: 'paged-host', version: '1' });
  let gateway: ReturnType<typeof createGatewayServer> | undefined;
  try {
    await fake.connect(fakeTransport);
    await upstream.connect(upstreamTransport);
    const catalog = new ToolCatalog(await upstream.listTools());
    gateway = createGatewayServer(catalog, createRouter({ upstream, catalog, configurationId: 'a'.repeat(64), audit: () => {} }));
    const [hostTransport, gatewayTransport] = InMemoryTransport.createLinkedPair();
    await gateway.connect(gatewayTransport);
    await host.connect(hostTransport);
    expect((await host.listTools()).tools.map(tool => tool.name)).toEqual(tools.map(tool => tool.name));
    expect(cursors).toEqual(tools.map((_, index) => index === 0 ? undefined : String(index)));
  } finally { await host.close(); await gateway?.close(); await upstream.close(); await fake.close(); }
});
