import { expect, it } from 'vitest';
import { sanitize } from '../../../src/security/sanitize.js';
import { configSchema } from '../../../src/config/schema.js';

it('recursively removes sensitive fields and credential values without mutating benign arguments', () => {
  const input = { toolName: 'echo', toolDescription: 'Authorization: Bearer abc.def.ghi', arguments: {
    text: 'hello', nested: [{ API_KEY: 'secret-canary', headers: { Authorization: 'hidden' }, env: { HOME: 'private' }, value: 'Bearer bearer-canary' }],
    url: 'https://user:pass@example.com', token: 'top-canary',
  } };
  const original = structuredClone(input);
  const clean = sanitize(input);
  expect(input).toEqual(original);
  expect(clean.arguments?.text).toBe('hello');
  expect(JSON.stringify(clean)).not.toMatch(/secret-canary|bearer-canary|top-canary|user:pass|private|abc.def.ghi/);
  expect(JSON.stringify(clean)).toContain('[REDACTED]');
});
it('bounds recursion and strings, and custom keys cannot disable built-in redaction', () => {
  const options = configSchema.parse({ version: 1, upstream: { command: 'node' }, sanitization: { redactKeys: ['custom'], maxDepth: 2, maxStringLength: 10 } }).sanitization;
  const result = sanitize({ toolName: 'echo', arguments: { password: 'hidden', custom: 'hidden', long: 'x'.repeat(11), a: { b: { text: 'hidden' } } } }, options);
  expect(JSON.stringify(result)).not.toContain('hidden');
  expect(result.arguments?.long).toBe('[REDACTED]');
});
