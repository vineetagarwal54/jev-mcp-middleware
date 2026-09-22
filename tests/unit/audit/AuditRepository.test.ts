import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { AuditRepository } from '../../../src/audit/AuditRepository.js';
import type { AuditEvent } from '../../../src/audit/AuditEvent.js';

it('initializes SQLite, persists and reads an event, and exposes insert failures', () => {
  const repository = new AuditRepository(':memory:');
  const event: AuditEvent = {
    schemaVersion: 1, eventId: randomUUID(), correlationId: randomUUID(), occurredAt: new Date().toISOString(),
    toolName: 'echo', validationStatus: 'VALID', configurationId: 'a'.repeat(64), totalLatencyMs: 2,
    policyDecision: { outcome: 'ALLOW', source: 'NO_PROVIDER', reasonCodes: ['NO_PROVIDER'], policyLatencyMs: 0, configurationId: 'a'.repeat(64) },
    upstreamOutcome: { status: 'SUCCESS', latencyMs: 1 },
  };
  try {
    repository.insert(event);
    expect(repository.findByCorrelationId(event.correlationId)).toEqual(event);
    expect(() => repository.insert(event)).toThrow();
  } finally { repository.close(); }
});
