import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { upstreamEnvironment } from '../config/loadConfig.js';
import type { GatewayConfig } from '../config/schema.js';

export function createUpstreamTransport(config: GatewayConfig['upstream']): StdioClientTransport {
  return new StdioClientTransport({ command: config.command, args: config.args, cwd: config.cwd,
    env: upstreamEnvironment(config.envPassthrough), stderr: 'ignore' });
}
