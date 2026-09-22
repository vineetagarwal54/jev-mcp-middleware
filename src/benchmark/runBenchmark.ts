import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { Server, InMemoryTransport } from '@modelcontextprotocol/server';
import { configSchema, type GatewayConfig } from '../config/schema.js';
import { loadConfig, configurationId } from '../config/loadConfig.js';
import { JevDecisionProvider } from '../decision/JevDecisionProvider.js';
import type { DecisionProvider } from '../decision/DecisionProvider.js';
import type { RiskSignals } from '../decision/types.js';
import type { AuditEvent } from '../audit/AuditEvent.js';
import { UpstreamClient } from '../mcp/upstreamClient.js';
import { ToolCatalog } from '../mcp/toolCatalog.js';
import { createRouter } from '../mcp/router.js';
import { loadDataset, type Dataset, type BenchmarkCase } from './dataset.js';
import { classificationMetrics, macroF1, percentiles } from './metrics.js';

export type BenchmarkMode = 'NO_SEMANTIC_GATE' | 'DETERMINISTIC_ONLY' | 'JEV' | 'PROVIDER';
interface CaseResult {
  caseId: string; expectedOutcome: BenchmarkCase['expectedOutcome']; actualOutcome: BenchmarkCase['expectedOutcome']; forwarded: boolean;
  decisionLatencyMs: number; providerLatencyMs?: number; errorCode?: string;
  expectedSignals: BenchmarkCase['labels']; actualSignals?: RiskSignals;
}
export async function runBenchmark({ mode, dataset, config, provider }: { mode: BenchmarkMode; dataset: Dataset; config: GatewayConfig; provider?: DecisionProvider }) {
  const semantic = mode === 'JEV' || mode === 'PROVIDER';
  if (!semantic && provider) throw new Error('This mode does not accept a provider');
  if (semantic && !provider) throw new Error('This mode requires an explicit provider');
  const effective = configSchema.parse(structuredClone(config));
  effective.provider.type = semantic ? mode === 'JEV' ? 'jev' : 'mock' : 'none';
  if (mode === 'NO_SEMANTIC_GATE') {
    effective.policy.hardRules = [];
    effective.policy.noProviderOutcome = 'ALLOW';
  }
  const id = configurationId(effective);
  const startedAt = new Date().toISOString();
  const tools = [...new Map(dataset.cases.map(c => [c.toolName, { name: c.toolName, description: c.toolDescription, inputSchema: { type: 'object' as const } }])).values()];
  const fake = new Server({ name: 'benchmark-upstream', version: '1' }, { capabilities: { tools: {} } });
  let forwards = 0;
  fake.setRequestHandler('tools/list', () => ({ tools }));
  fake.setRequestHandler('tools/call', () => { forwards++; return { content: [{ type: 'text', text: 'synthetic result' }] }; });
  const upstream = new UpstreamClient();
  const [a, b] = InMemoryTransport.createLinkedPair();
  const caseResults: CaseResult[] = [];
  try {
    await fake.connect(b);
    await upstream.connect(a);
    const catalog = new ToolCatalog(await upstream.listTools());
    let event: AuditEvent | undefined;
    const route = createRouter({ upstream, catalog, config: effective, configurationId: id, ...(provider ? { provider } : {}), audit: e => { event = e; } });
    // Fixed dataset order; the recorded seed is reserved for reproducible future sampling.
    for (const c of dataset.cases) {
      event = undefined;
      const before = forwards;
      await route({ name: c.toolName, arguments: c.arguments });
      // The route guarantees one synchronous audit callback before resolving.
      const audit = event as AuditEvent | undefined;
      if (!audit) throw new Error('Benchmark audit missing');
      const evaluation = audit.providerEvaluation;
      caseResults.push({ caseId: c.id, expectedOutcome: c.expectedOutcome, actualOutcome: audit.policyDecision.outcome,
        forwarded: forwards > before, decisionLatencyMs: Math.max(0, audit.totalLatencyMs - (audit.upstreamOutcome.latencyMs ?? 0)), expectedSignals: c.labels,
        ...(evaluation ? { providerLatencyMs: evaluation.latencyMs } : {}),
        ...(evaluation?.status === 'SUCCESS' ? { actualSignals: evaluation.signals } : {}),
        ...(evaluation && evaluation.status !== 'SUCCESS' ? { errorCode: evaluation.reasonCode ?? 'PROVIDER_FAILURE' } : {}) });
    }
  } finally { await upstream.close(); await fake.close(); }
  const classified = caseResults.filter((c): c is CaseResult & { actualSignals: RiskSignals } => c.actualSignals !== undefined);
  const signalNames = ['destructive', 'externalConsequence', 'sensitive', 'irreversible', 'highImpact', 'humanReview'] as const;
  const signals = classified.length ? Object.fromEntries(signalNames.map(key => [key,
    classificationMetrics(classified.map(c => c.expectedSignals[key]), classified.map(c => c.actualSignals[key] >= 0.5))])) : {};
  const semanticEvaluated = caseResults.filter(c => c.providerLatencyMs !== undefined).length;
  const providerErrors = caseResults.filter(c => c.errorCode !== undefined).length;
  return { schemaVersion: 1, runId: randomUUID(), datasetVersion: dataset.version, datasetHash: dataset.hash, configurationId: id, mode,
    ...(provider ? { provider: { id: provider.id } } : {}), runtime: { nodeVersion: process.version, platform: process.platform, architecture: process.arch },
    seed: config.benchmark?.seed ?? 1, startedAt, completedAt: new Date().toISOString(),
    counts: { total: caseResults.length, completed: caseResults.length, errors: providerErrors,
      semanticEvaluated, semanticSkipped: caseResults.length - semanticEvaluated,
      semanticPredicted: classified.length, providerErrors,
      forwarded: forwards, unexpectedForwarding: caseResults.filter(c => c.forwarded && c.expectedOutcome !== 'ALLOW').length },
    quality: { policyAccuracy: caseResults.filter(c => c.actualOutcome === c.expectedOutcome).length / (caseResults.length || 1), macroF1: macroF1(signals), signals },
    latency: { providerMs: percentiles(caseResults.flatMap(c => c.providerLatencyMs === undefined ? [] : [c.providerLatencyMs])), decisionMs: percentiles(caseResults.map(c => c.decisionLatencyMs)) },
    caseResults };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { values } = parseArgs({ options: { config: { type: 'string' }, mode: { type: 'string' } } });
    if (!values.config) throw new Error('Configuration required');
    const config = loadConfig(values.config);
    if (!config.benchmark) throw new Error('Benchmark configuration required');
    const modes = { 'no-semantic-gate': 'NO_SEMANTIC_GATE', 'deterministic-only': 'DETERMINISTIC_ONLY', jev: 'JEV' } as const;
    if (!values.mode || !Object.hasOwn(modes, values.mode)) throw new Error('Unknown mode');
    const mode = modes[values.mode as keyof typeof modes];
    const dataset = await loadDataset(config.benchmark.datasetPath);
    const provider = mode === 'JEV' ? new JevDecisionProvider(config.provider) : undefined;
    const result = await runBenchmark({ mode, dataset, config, ...(provider ? { provider } : {}) });
    await mkdir(config.benchmark.resultsDirectory, { recursive: true });
    await writeFile(join(config.benchmark.resultsDirectory, `${result.runId}.json`), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    process.stdout.write(JSON.stringify({ runId: result.runId, mode, counts: result.counts, quality: result.quality, latency: result.latency }) + '\n');
  } catch {
    process.stderr.write('Benchmark failed. Check --config, --mode, dataset and (for Jev only) TYPESAFE_API_KEY.\n');
    process.exitCode = 1;
  }
}
