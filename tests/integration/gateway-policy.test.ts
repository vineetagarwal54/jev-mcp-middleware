import { expect, it } from 'vitest';
import { gatewayHarness } from '../fixtures/gatewayHarness.js';
import { configSchema } from '../../src/config/schema.js';
import { LayaDecisionProvider, type LayaClient } from '../../src/decision/LayaDecisionProvider.js';
import { vi } from 'vitest';

it('never forwards hard DENY, semantic DENY, REVIEW or failed decisions, including concurrent calls', async () => {
  const config = configSchema.parse({ version: 1, upstream: { command: 'node' }, policy: { hardRules: [
    { id: 'block', tool: 'echo', arguments: [{ pointer: '/text', operator: 'glob', value: 'blocked*' }], outcome: 'DENY' },
  ] } });
  const signals = { destructive: 0, externalConsequence: 0, sensitive: 0, irreversible: 0, highImpact: 0, humanReview: 0 };
  const scores = [0.95, 0.6, 0.1];
  const providerCalls: unknown[] = [];
  const client: LayaClient = { systemOne: async state => {
    providerCalls.push(state);
    const score = scores.shift();
    if (score === undefined) throw new Error('local inference unavailable');
    return { model: 'laya', usage: { input_tokens: 10, output_tokens: 0 }, answers: {
      destructive: { type: 'noul', noul: score },
      external_consequence: { type: 'noul', noul: signals.externalConsequence },
      sensitive: { type: 'noul', noul: signals.sensitive },
      irreversible: { type: 'noul', noul: signals.irreversible },
      high_impact: { type: 'noul', noul: signals.highImpact },
      human_review: { type: 'noul', noul: signals.humanReview },
    } };
  } };
  const provider = new LayaDecisionProvider(client, () => true);
  const h = await gatewayHarness({ config, provider });
  try {
    const blocked = await Promise.all(Array.from({ length: 8 }, (_, i) => h.host.callTool({ name: 'echo', arguments: { text: `blocked-${i}` } })));
    expect(blocked.every(r => r.isError)).toBe(true);
    expect(providerCalls).toHaveLength(0);
    expect(h.fake.calls).toHaveLength(0);
    for (const outcome of ['DENY', 'REVIEW', 'ALLOW', 'DENY']) {
      const result = await h.host.callTool({ name: 'echo', arguments: { text: 'eligible' } });
      expect(h.events.at(-1)?.policyDecision.outcome).toBe(outcome);
      if (outcome !== 'ALLOW') expect(result._meta?.['dev.jev-mcp-middleware/decision']).toMatchObject({ outcome });
    }
    expect(h.fake.calls).toEqual([{ name: 'echo', arguments: { text: 'eligible' } }]);
    expect(providerCalls).toHaveLength(4);
    expect(h.events.filter(e => e.policyDecision.outcome !== 'ALLOW').every(e => e.upstreamOutcome.status === 'NOT_ATTEMPTED')).toBe(true);
  } finally { await h.close(); }
});

it('enforces a provider deadline even when an adapter never settles', async () => {
  const config = configSchema.parse({ version: 1, upstream: { command: 'node' }, provider: { timeoutMs: 10 } });
  const provider = { id: 'stalled', evaluate: () => new Promise<never>(() => {}) };
  const h = await gatewayHarness({ config, provider });
  try {
    vi.useFakeTimers();
    const result = h.host.callTool({ name: 'echo', arguments: { text: 'hello' } });
    await vi.advanceTimersByTimeAsync(20);
    expect((await result).isError).toBe(true);
    expect(h.events[0]?.providerEvaluation?.status).toBe('TIMEOUT');
    expect(h.fake.calls).toHaveLength(0);
  } finally { vi.useRealTimers(); await h.close(); }
});

it('records a pre-dispatch cancellation clearly and never forwards it', async () => {
  const h = await gatewayHarness();
  try {
    const result = await h.route({ name: 'echo', arguments: { text: 'cancelled' } }, AbortSignal.abort());
    expect(result).toMatchObject({ isError: true, content: [{ text: 'Call cancelled.' }] });
    expect(h.events).toHaveLength(1);
    expect(h.events[0]).toMatchObject({
      validationStatus: 'VALID',
      policyDecision: { outcome: 'DENY', source: 'CANCELLATION', reasonCodes: ['CALL_CANCELLED'] },
      upstreamOutcome: { status: 'NOT_ATTEMPTED', reasonCode: 'CALL_CANCELLED' },
    });
    expect(h.fake.calls).toHaveLength(0);
  } finally { await h.close(); }
});
