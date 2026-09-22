import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { serveStdio, type StdioServerHandle } from '@modelcontextprotocol/server/stdio';
import { loadConfig, configurationId, validateProviderConfiguration } from './config/loadConfig.js';
import { createDecisionProvider, type DecisionProviderHandle } from './decision/createDecisionProvider.js';
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
  validateProviderConfiguration(config);
  const logger = createLogger(config.logging.level);
  const upstream = new UpstreamClient(config.upstream.requestTimeoutMs);
  let providerHandle: DecisionProviderHandle | undefined;
  let repository: AuditRepository | undefined;
  let handle: StdioServerHandle | undefined;
  let closing: Promise<void> | undefined;
  const shutdown = (): Promise<void> => closing ??= (async () => {
    try { await handle?.close(); } finally {
      try { await upstream.close(); } finally {
        try { repository?.close(); } finally { await providerHandle?.close(); }
      }
    }
  })();
  try {
    providerHandle = await createDecisionProvider(config.provider);
    repository = new AuditRepository(config.audit.sqlitePath, config.audit.busyTimeoutMs);
    await upstream.connect(createUpstreamTransport(config.upstream));
    const catalog = new ToolCatalog(await upstream.listTools());
    const route = createRouter({ upstream, catalog, config, ...(providerHandle.provider ? { provider: providerHandle.provider } : {}),
      configurationId: configurationId(config), audit: createAuditService(repository, logger) });
    // The SDK may replace a server instance during protocol negotiation; only
    // process/transport shutdown should close the shared upstream connection.
    handle = serveStdio(() => createGatewayServer(catalog, route),
      { onerror: () => logger.error({ event: 'downstream_protocol_error' }) });
    logger.info({ event: 'gateway_started', provider: config.provider.type, providerFailureOutcome: config.policy.providerFailureOutcome });
    return shutdown;
  } catch (error) { await shutdown(); throw error; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const logger = createLogger();
  try {
    const { values } = parseArgs({ options: { config: { type: 'string' }, 'check-config': { type: 'boolean' }, help: { type: 'boolean' } } });
    if (values.help) {
      process.stderr.write('Usage: node dist/index.js --config <gateway.yaml> [--check-config]\nResearch tooling only; not a production security guarantee.\n');
    } else {
      if (!values.config) throw new Error('Configuration required');
      if (values['check-config']) {
        const config = loadConfig(values.config);
        validateProviderConfiguration(config);
        logger.info({ event: 'configuration_valid', configurationId: configurationId(config), providerFailureOutcome: config.policy.providerFailureOutcome });
      } else {
        const shutdown = await startGateway(values.config);
        const stop = () => { void shutdown().catch(() => { process.exitCode = 1; }); };
        process.once('SIGINT', stop);
        process.once('SIGTERM', stop);
        process.stdin.once('end', stop);
      }
    }
  } catch {
    logger.error({ event: 'gateway_startup_failed', hint: 'Use --config <path>; verify configuration, provider credential, upstream and audit storage' });
    process.exitCode = 1;
  }
}
