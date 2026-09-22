import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { createFakeMcpServer } from './fakeMcpServer.js';
import { UpstreamClient } from '../../src/mcp/upstreamClient.js';
import { ToolCatalog } from '../../src/mcp/toolCatalog.js';
import { createRouter } from '../../src/mcp/router.js';
import { createGatewayServer } from '../../src/mcp/gatewayServer.js';
import { configSchema, type GatewayConfig } from '../../src/config/schema.js';
import type { DecisionProvider } from '../../src/decision/DecisionProvider.js';
import type { AuditEvent } from '../../src/audit/AuditEvent.js';

export async function gatewayHarness(options: { config?: GatewayConfig; provider?: DecisionProvider; audit?: (event: AuditEvent) => void } = {}) {
  const config = options.config ?? configSchema.parse({ version: 1, upstream: { command: 'node' } });
  const fake = createFakeMcpServer();
  const upstream = new UpstreamClient(2000);
  const [a, b] = InMemoryTransport.createLinkedPair();
  await fake.server.connect(b);
  await upstream.connect(a);
  const events: AuditEvent[] = [];
  const catalog = new ToolCatalog(await upstream.listTools());
  const gateway = createGatewayServer(catalog, createRouter({ upstream, catalog, config, configurationId: 'a'.repeat(64),
    ...(options.provider ? { provider: options.provider } : {}), audit: event => { events.push(event); options.audit?.(event); } }));
  const [c, d] = InMemoryTransport.createLinkedPair();
  await gateway.connect(d);
  const host = new Client({ name: 'test', version: '1' });
  await host.connect(c);
  return { host, fake, events, close: async () => { await host.close(); await gateway.close(); await upstream.close(); await fake.server.close(); } };
}
