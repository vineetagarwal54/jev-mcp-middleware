import { pathToFileURL } from 'node:url';
import { serveStdio, type StdioServerHandle } from '@modelcontextprotocol/server/stdio';
import { loadConfig, configurationId } from './config/loadConfig.js';
import { createLogger } from './logging/logger.js';
import { AuditRepository } from './audit/AuditRepository.js';
import { createAuditService } from './audit/auditService.js';
import { createUpstreamTransport } from './mcp/transportFactories.js';
import { UpstreamClient } from './mcp/upstreamClient.js';
import { ToolCatalog } from './mcp/toolCatalog.js';
import { createRouter } from './mcp/router.js';
import { createGatewayServer } from './mcp/gatewayServer.js';

export async function startGateway(configPath: string): Promise<() => Promise<void>> {
  const config = loadConfig(configPath);
  if (config.provider.type !== 'none' || config.policy.hardRules.length || config.policy.noProviderOutcome !== 'ALLOW') {
    throw new Error('This US1 increment supports only provider:none, no hard rules and noProviderOutcome:ALLOW');
  }
  const logger = createLogger(config.logging.level);
  const upstream = new UpstreamClient(config.upstream.requestTimeoutMs);
  const repository = new AuditRepository(config.audit.sqlitePath, config.audit.busyTimeoutMs);
  let handle: StdioServerHandle | undefined;
  let closing: Promise<void> | undefined;
  const shutdown = (): Promise<void> => closing ??= (async () => {
    try { await handle?.close(); } finally {
      try { await upstream.close(); } finally { repository.close(); }
    }
  })();
  try {
    await upstream.connect(createUpstreamTransport(config.upstream));
    const catalog = new ToolCatalog(await upstream.listTools());
    const route = createRouter({ upstream, catalog, configurationId: configurationId(config), audit: createAuditService(repository, logger) });
    // The SDK may replace a server instance during protocol negotiation; only
    // process/transport shutdown should close the shared upstream connection.
    handle = serveStdio(() => createGatewayServer(catalog, route),
      { onerror: () => logger.error({ event: 'downstream_protocol_error' }) });
    logger.info({ event: 'gateway_started', mode: 'transparent_proxy', providerFailureOutcome: config.policy.providerFailureOutcome });
    return shutdown;
  } catch (error) { await shutdown(); throw error; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const logger = createLogger();
  try {
    if (process.argv.length !== 4 || process.argv[2] !== '--config' || !process.argv[3]) throw new Error('Usage');
    const shutdown = await startGateway(process.argv[3]);
    const stop = () => { void shutdown().catch(() => { process.exitCode = 1; }); };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    process.stdin.once('end', stop);
  } catch {
    logger.error({ event: 'gateway_startup_failed', hint: 'Use --config <path>; verify configuration, supported US1 mode, upstream and audit storage' });
    process.exitCode = 1;
  }
}
