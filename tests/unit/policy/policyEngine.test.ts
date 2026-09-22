import { expect, it } from 'vitest';
import { configSchema } from '../../../src/config/schema.js';
import { evaluatePolicy, evaluateBeforeProvider } from '../../../src/policy/policyEngine.js';
import type { RiskSignals } from '../../../src/decision/types.js';

const config = configSchema.parse({ version: 1, upstream: { command: 'node' } }).policy;
const signals: RiskSignals = { destructive: 0, externalConsequence: 0, sensitive: 0, irreversible: 0, highImpact: 0, humanReview: 0 };
it('resolves hard rules DENY > REVIEW > ALLOW, matches JSON pointers and skips semantic work', () => {
  const policy = { ...config, hardRules: [
    { id: 'allow', tool: '*', arguments: [], outcome: 'ALLOW' as const },
    { id: 'review', tool: 'file.*', arguments: [], outcome: 'REVIEW' as const },
    { id: 'deny', tool: 'file.*', arguments: [{ pointer: '/a~1b', operator: 'equals' as const, value: 'delete' }], outcome: 'DENY' as const },
  ] };
  expect(evaluateBeforeProvider(policy, 'file.write', { 'a/b': 'delete' }, true)).toMatchObject({ outcome: 'DENY', hardRuleId: 'deny' });
  expect(evaluateBeforeProvider(policy, 'file.write', {}, true)?.outcome).toBe('REVIEW');
  expect(evaluateBeforeProvider(policy, 'echo', {}, true)?.outcome).toBe('ALLOW');
  expect(evaluateBeforeProvider({ ...config, semanticEligibility: { includeTools: ['*'], excludeTools: ['echo'] }, noProviderOutcome: 'REVIEW' }, 'echo', {}, true)?.outcome).toBe('REVIEW');
});
it('owns threshold outcomes and explicitly maps failures', () => {
  for (const [score, outcome] of [[0.1, 'ALLOW'], [0.5, 'REVIEW'], [0.9, 'DENY']] as const) {
    expect(evaluatePolicy(config, { provider: 'mock', status: 'SUCCESS', signals: { ...signals, destructive: score }, latencyMs: 0 }).outcome).toBe(outcome);
  }
  for (const outcome of ['ALLOW', 'REVIEW', 'DENY'] as const) {
    expect(evaluatePolicy({ ...config, providerFailureOutcome: outcome }, { provider: 'mock', status: 'TIMEOUT', latencyMs: 1 })).toMatchObject({ outcome, source: 'PROVIDER_FAILURE', failureBehavior: outcome });
  }
});
