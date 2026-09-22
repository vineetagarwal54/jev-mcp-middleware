import { expect, it } from 'vitest';
import { LayaDecisionProvider, type LayaClient } from '../../../src/decision/LayaDecisionProvider.js';
import { RISK_QUESTION_INSTRUCTIONS } from '../../../src/decision/riskQuestions.js';
import { sanitize } from '../../../src/security/sanitize.js';

const response = (destructive = 0.1) => ({
  model: 'laya',
  usage: { input_tokens: 42, output_tokens: 0 },
  answers: {
    destructive: { type: 'noul', noul: destructive },
    external_consequence: { type: 'noul', noul: 0.2 },
    sensitive: { type: 'noul', noul: 0.3 },
    irreversible: { type: 'noul', noul: 0.4 },
    high_impact: { type: 'noul', noul: 0.5 },
    human_review: { type: 'noul', noul: 0.6 },
  },
});

it('batches the shared six Noul questions and exposes invalid/context failures without model access', async () => {
  const calls: { state: unknown; questions: unknown }[] = [];
  const results: unknown[] = [response(), response(1.1)];
  const client: LayaClient = { systemOne: async (state, questions) => {
    calls.push({ state, questions });
    return results.shift();
  } };
  const provider = new LayaDecisionProvider(client, () => true);
  const input = sanitize({ toolName: 'echo', toolDescription: 'Echo text', arguments: { token: 'secret-canary', text: 'hello' } });

  const success = await provider.evaluate(input, { signal: new AbortController().signal });
  expect(success).toMatchObject({ provider: 'laya', status: 'SUCCESS', model: 'laya', usage: { inputTokens: 42, outputTokens: 0 },
    signals: { destructive: 0.1, externalConsequence: 0.2, sensitive: 0.3, irreversible: 0.4, highImpact: 0.5, humanReview: 0.6 } });
  expect(calls).toHaveLength(1);
  expect(calls[0]?.state).toEqual(input);
  expect(calls[0]?.questions).toEqual(Object.fromEntries(Object.entries(RISK_QUESTION_INSTRUCTIONS)
    .map(([id, instructions]) => [id, { type: 'noul', instructions }])));
  expect(JSON.stringify(calls)).not.toContain('secret-canary');

  expect(await provider.evaluate(input, { signal: new AbortController().signal }))
    .toMatchObject({ status: 'INVALID', reasonCode: 'PROVIDER_INVALID_RESPONSE' });

  const rejected = new LayaDecisionProvider(client, () => false);
  expect(await rejected.evaluate(input, { signal: new AbortController().signal }))
    .toMatchObject({ status: 'INVALID', reasonCode: 'PROVIDER_CONTEXT_LIMIT' });
  expect(calls).toHaveLength(2);
});
