import { expect, it } from 'vitest';
import { MockDecisionProvider } from '../../../src/decision/MockDecisionProvider.js';

it('scripts advisory results, snapshots inputs, and represents exhaustion and abort explicitly', async () => {
  const signals = { destructive: 0, externalConsequence: 0, sensitive: 0, irreversible: 0, highImpact: 0, humanReview: 0 };
  const provider = new MockDecisionProvider([{ provider: 'mock', status: 'SUCCESS', signals, latencyMs: 1 }]);
  const input = { toolName: 'echo', arguments: { text: 'hello' } };
  const options = { signal: new AbortController().signal };
  expect((await provider.evaluate(input, options)).status).toBe('SUCCESS');
  input.arguments.text = 'changed';
  expect(provider.calls[0]?.arguments).toEqual({ text: 'hello' });
  expect((await provider.evaluate(input, options)).status).toBe('INVALID');
  expect((await provider.evaluate(input, { signal: AbortSignal.abort() })).status).toBe('ABORTED');
});
