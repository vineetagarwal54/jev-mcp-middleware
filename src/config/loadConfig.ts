import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseDocument } from 'yaml';
import { configSchema, type GatewayConfig } from './schema.js';

export function parseConfig(yaml: string, directory: string): GatewayConfig {
  try {
    const document = parseDocument(yaml, { version: '1.2' });
    if (document.errors.length) throw new Error();
    const config = configSchema.parse(document.toJS({ maxAliasCount: 20 }));
    config.upstream.cwd = resolve(directory, config.upstream.cwd);
    if (!statSync(config.upstream.cwd).isDirectory()) throw new Error();
    if (config.audit.sqlitePath !== ':memory:') config.audit.sqlitePath = resolve(directory, config.audit.sqlitePath);
    if (config.provider.type === 'laya') {
      if (config.provider.modelDir !== undefined) config.provider.modelDir = resolve(directory, config.provider.modelDir);
      if (config.provider.cacheDir !== undefined) config.provider.cacheDir = resolve(directory, config.provider.cacheDir);
    }
    if (config.benchmark) {
      config.benchmark.datasetPath = resolve(directory, config.benchmark.datasetPath);
      config.benchmark.resultsDirectory = resolve(directory, config.benchmark.resultsDirectory);
      if (config.benchmark.resultsDirectory === dirname(config.audit.sqlitePath)) throw new Error();
    }
    return config;
  } catch { throw new Error('Invalid configuration'); }
}
export function loadConfig(path: string): GatewayConfig {
  let yaml: string;
  try { yaml = readFileSync(path, 'utf8'); } catch { throw new Error('Unable to read configuration'); }
  return parseConfig(yaml, dirname(resolve(path)));
}
export function configurationId(config: GatewayConfig): string {
  return createHash('sha256').update(JSON.stringify(config)).digest('hex');
}
export function validateProviderConfiguration(config: GatewayConfig): void {
  if (config.provider.type === 'mock') throw new Error('Mock providers are available only in tests and benchmarks');
  if (config.provider.type === 'jev' && !process.env.TYPESAFE_API_KEY?.trim()) throw new Error('Jev requires TYPESAFE_API_KEY');
}
/** Secrets are resolved only at the upstream transport boundary, never added to config. */
export function upstreamEnvironment(names: readonly string[], environment: NodeJS.ProcessEnv = process.env): Record<string, string> {
  return Object.fromEntries(names.flatMap(name => environment[name] === undefined ? [] : [[name, environment[name]]]));
}
