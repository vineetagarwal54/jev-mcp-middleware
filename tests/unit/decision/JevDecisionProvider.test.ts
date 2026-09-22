import { expect, it } from 'vitest';
import { JevDecisionProvider, type JevClient } from '../../../src/decision/JevDecisionProvider.js';
import { configSchema } from '../../../src/config/schema.js';
import { sanitize } from '../../../src/security/sanitize.js';

it('sends only sanitized state, maps all six signals, and rejects malformed responses', async () => {
  const requests: unknown[] = [];
  let malformed = false;
  const client: JevClient = { systemOne: async request => {
    requests.push(request);
    return { model: 'jev-latest', usage: { input_tokens: 10, output_tokens: 6 }, answers: malformed ? {} : {
      destructive: { type: 'noul', noul: 0.1 }, external_consequence: { type: 'noul', noul: 0.2 }, sensitive: { type: 'noul', noul: 0.3 },
      irreversible: { type: 'noul', noul: 0.4 }, high_impact: { type: 'noul', noul: 0.5 }, human_review: { type: 'noul', noul: 0.6 },
    } };
  } };
  const config = configSchema.parse({ version: 1, upstream: { command: 'node' }, provider: { type: 'jev' } });
  if (config.provider.type !== 'jev') throw new Error('Expected Jev configuration');
  const provider = new JevDecisionProvider(config.provider, client);
  const input = sanitize({ toolName: 'echo', arguments: { password: 'secret-canary', text: 'hello' } });
  const result = await provider.evaluate(input, { signal: new AbortController().signal });
  expect(result).toMatchObject({ status: 'SUCCESS', signals: { destructive: 0.1, externalConsequence: 0.2, sensitive: 0.3, irreversible: 0.4, highImpact: 0.5, humanReview: 0.6 } });
  expect(JSON.stringify(requests)).not.toContain('secret-canary');
  expect(requests[0]).toMatchObject({ state: input });
  malformed = true;
  expect(await provider.evaluate(input, { signal: new AbortController().signal })).toMatchObject({ status: 'INVALID', reasonCode: 'PROVIDER_INVALID_RESPONSE' });
});
