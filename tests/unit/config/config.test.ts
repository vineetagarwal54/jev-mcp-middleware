import { describe, expect, it } from 'vitest';
import { parseConfig } from '../../../src/config/loadConfig.js';

describe('configuration boundary', () => {
  it('normalizes safe defaults and resolves paths without embedding environment values', () => {
    const config = parseConfig('version: 1\nupstream:\n  command: node\n', process.cwd());
    expect(config.policy.providerFailureOutcome).toBe('DENY');
    expect(config.upstream.cwd).toBe(process.cwd());
    expect(config.provider.type).toBe('none');
  });
  it.each([
    'version: 1\nupstream: {command: node, headers: {Authorization: secret}}',
    'version: 1\nupstream: {command: node, requestTimeoutMs: 0}',
    'version: 1\nupstream: {command: node}\nprovider: {timeoutMs: -1}',
    'version: 1\nupstream: {command: node}\n---\nversion: 1',
  ])('rejects invalid YAML/configuration without disclosing its values', (yaml) => {
    expect(() => parseConfig(yaml, process.cwd())).toThrow('Invalid configuration');
    try { parseConfig(yaml, process.cwd()); } catch (error) {
      expect(String(error)).not.toContain('secret');
    }
  });
});
