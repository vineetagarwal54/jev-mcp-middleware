import { expect, it } from 'vitest';
import { gatewayHarness } from '../fixtures/gatewayHarness.js';
import { AuditRepository } from '../../src/audit/AuditRepository.js';
import { MockDecisionProvider } from '../../src/decision/MockDecisionProvider.js';
import { configSchema } from '../../src/config/schema.js';
import { pino } from 'pino';
import { Writable } from 'node:stream';
import { createAuditService } from '../../src/audit/auditService.js';
import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';

it('uses sanitized semantic input and one sanitized SQLite event per call, including provider failure', async () => {
  const signals = { destructive: 0, externalConsequence: 0, sensitive: 0, irreversible: 0, highImpact: 0, humanReview: 0 };
  const provider = new MockDecisionProvider([
    { provider: 'mock', status: 'SUCCESS', signals, latencyMs: 1 },
    { provider: 'mock', status: 'TIMEOUT', latencyMs: 2, reasonCode: 'PROVIDER_TIMEOUT' },
  ]);
  const repository = new AuditRepository(':memory:');
  let logs = '';
  const logger = pino({ base: null }, new Writable({ write(chunk, _encoding, done) { logs += String(chunk); done(); } }));
  const audit = createAuditService(repository, logger);
  const config = configSchema.parse({ version: 1, upstream: { command: 'node' }, policy: { providerFailureOutcome: 'REVIEW' } });
  const h = await gatewayHarness({ provider, config, audit });
  try {
    const args = { text: 'Bearer secret-canary', nested: { Authorization: 'secret-canary', env: { PRIVATE: 'secret-canary' } } };
    await h.host.callTool({ name: 'echo', arguments: args });
    await h.host.callTool({ name: 'echo', arguments: { text: 'benign' } });
    expect(h.fake.calls).toEqual([{ name: 'echo', arguments: args }]);
    expect(provider.calls[0]?.arguments?.text).toBe('[REDACTED]');
    expect(h.events).toHaveLength(2);
    const validate = new Ajv2020({ strict: false, validateFormats: false }).compile(JSON.parse(readFileSync('specs/001-mcp-policy-gateway/contracts/audit-event.schema.json', 'utf8')));
    for (const event of h.events) expect(validate(event), JSON.stringify(validate.errors)).toBe(true);
    for (const event of h.events) expect(repository.findByCorrelationId(event.correlationId)).toEqual(event);
    expect(h.events[1]).toMatchObject({ policyDecision: { outcome: 'REVIEW', source: 'PROVIDER_FAILURE' }, upstreamOutcome: { status: 'NOT_ATTEMPTED' } });
    expect(JSON.stringify([provider.calls, h.events])).not.toContain('secret-canary');
    expect(logs).not.toContain('secret-canary');
    // One deliberate persistence failure is observable and cannot rewrite a result.
    const first = h.events[0];
    if (!first) throw new Error('Missing audit');
    audit(first);
    expect(logs).toContain('audit_write_failed');
  } finally { await h.close(); repository.close(); }
});
