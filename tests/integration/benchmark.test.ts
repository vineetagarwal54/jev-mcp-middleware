import { expect, it } from 'vitest';
import { loadDataset } from '../../src/benchmark/dataset.js';
import { runBenchmark } from '../../src/benchmark/runBenchmark.js';
import { configSchema } from '../../src/config/schema.js';
import { MockDecisionProvider } from '../../src/decision/MockDecisionProvider.js';
import type { RiskSignals } from '../../src/decision/types.js';
import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';

it('compares keyless modes on one labelled corpus with actual forwarding and quality/latency reports', async () => {
  const dataset = await loadDataset('benchmarks/datasets/v0.1.jsonl');
  const config = configSchema.parse({ version: 1, upstream: { command: 'node' }, policy: { hardRules: [
    { id: 'delete', tool: '*.delete', outcome: 'DENY' },
  ] } });
  const noGate = await runBenchmark({ mode: 'NO_SEMANTIC_GATE', dataset, config });
  const rules = await runBenchmark({ mode: 'DETERMINISTIC_ONLY', dataset, config });
  expect(noGate.counts.forwarded).toBe(dataset.cases.length);
  expect(rules.counts.forwarded).toBeLessThan(noGate.counts.forwarded);
  const cleanConfig = configSchema.parse({ version: 1, upstream: { command: 'node' } });
  const provider = new MockDecisionProvider(dataset.cases.map(c => ({ provider: 'mock', status: 'SUCCESS', latencyMs: 1,
    signals: Object.fromEntries(Object.entries(c.labels).map(([key, value]) => [key, value ? 1 : 0])) as RiskSignals })));
  const semantic = await runBenchmark({ mode: 'PROVIDER', dataset, config: cleanConfig, provider });
  expect(semantic.quality.macroF1).toBe(1);
  expect(semantic.counts.unexpectedForwarding).toBe(0);
  expect(provider.calls).toHaveLength(dataset.cases.length);
  expect(semantic.latency.providerMs.p50).toBe(1);
  expect(semantic.caseResults.every(r => Number.isInteger(r.decisionLatencyMs))).toBe(true);
  expect(noGate.datasetHash).toBe(semantic.datasetHash);
  const providerScript = () => dataset.cases.map(c => ({ provider: 'scripted', status: 'SUCCESS' as const, latencyMs: 2,
    signals: Object.fromEntries(Object.entries(c.labels).map(([key, value]) => [key, value ? 1 : 0])) as RiskSignals }));
  const jev = new MockDecisionProvider(providerScript());
  const laya = new MockDecisionProvider(providerScript());
  const jevReport = await runBenchmark({ mode: 'JEV', dataset, config: cleanConfig, provider: jev, providerInitializationMs: 0 });
  const layaReport = await runBenchmark({ mode: 'LAYA', dataset, config: cleanConfig, provider: laya, providerInitializationMs: 37 });
  expect(layaReport.latency.providerInitializationMs).toBe(37);
  expect(layaReport.caseResults.map(r => r.caseId)).toEqual(jevReport.caseResults.map(r => r.caseId));
  expect(layaReport.caseResults.map(r => r.actualOutcome)).toEqual(jevReport.caseResults.map(r => r.actualOutcome));
  expect(layaReport.quality).toEqual(jevReport.quality);
  const eligible = dataset.cases.filter(c => !c.toolName.endsWith('.delete'));
  const partialProvider = new MockDecisionProvider(eligible.map((c, index) => index === 0
    ? { provider: 'mock', status: 'TIMEOUT' as const, latencyMs: 1, reasonCode: 'PROVIDER_TIMEOUT' }
    : { provider: 'mock', status: 'SUCCESS' as const, latencyMs: 1,
      signals: Object.fromEntries(Object.entries(c.labels).map(([key, value]) => [key, value ? 1 : 0])) as RiskSignals }));
  const partial = await runBenchmark({ mode: 'PROVIDER', dataset, config, provider: partialProvider });
  expect(partial.counts).toMatchObject({ total: dataset.cases.length, semanticEvaluated: eligible.length,
    semanticSkipped: dataset.cases.length - eligible.length, semanticPredicted: eligible.length - 1, providerErrors: 1 });
  expect(partialProvider.calls).toHaveLength(eligible.length);
  const contextProvider = new MockDecisionProvider([
    { provider: 'laya', status: 'INVALID', latencyMs: 0, reasonCode: 'PROVIDER_CONTEXT_LIMIT' },
    ...dataset.cases.slice(1).map(c => ({ provider: 'laya', status: 'SUCCESS' as const, latencyMs: 1,
      signals: Object.fromEntries(Object.entries(c.labels).map(([key, value]) => [key, value ? 1 : 0])) as RiskSignals })),
  ]);
  const contextReport = await runBenchmark({ mode: 'LAYA', dataset, config: cleanConfig, provider: contextProvider, providerInitializationMs: 12 });
  expect(contextReport.counts).toMatchObject({ contextRejected: 1, providerErrors: 1, semanticPredicted: dataset.cases.length - 1 });
  expect(contextReport.caseResults[0]?.errorCode).toBe('PROVIDER_CONTEXT_LIMIT');
  const validate = new Ajv2020({ strict: false, validateFormats: false }).compile(JSON.parse(readFileSync('specs/001-mcp-policy-gateway/contracts/benchmark-result.schema.json', 'utf8')));
  for (const report of [noGate, rules, semantic, jevReport, layaReport, partial, contextReport]) expect(validate(report), JSON.stringify(validate.errors)).toBe(true);
  await expect(runBenchmark({ mode: 'DETERMINISTIC_ONLY', dataset, config, provider })).rejects.toThrow('does not accept a provider');
});
