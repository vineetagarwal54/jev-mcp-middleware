import { randomUUID } from 'node:crypto';
import { ProtocolError, type CallToolRequestParams, type CallToolResult } from '@modelcontextprotocol/server';
import type { AuditEvent } from '../audit/AuditEvent.js';
import { newCorrelationId } from '../logging/logger.js';
import type { ToolCatalog } from './toolCatalog.js';
import type { UpstreamClient } from './upstreamClient.js';
import { configSchema, type GatewayConfig } from '../config/schema.js';
import type { DecisionProvider } from '../decision/DecisionProvider.js';
import type { ProviderEvaluation } from '../decision/types.js';
import { evaluateProvider } from '../decision/evaluateProvider.js';
import { evaluateBeforeProvider, evaluatePolicy } from '../policy/policyEngine.js';
import { gatewayError, policyError } from './errors.js';
import { sanitize } from '../security/sanitize.js';

interface RouterDependencies {
  readonly upstream: UpstreamClient;
  readonly catalog: ToolCatalog;
  readonly configurationId: string;
  readonly audit: (event: AuditEvent) => void;
  readonly config?: GatewayConfig;
  readonly provider?: DecisionProvider;
}
export type ToolRouter = (params: CallToolRequestParams, signal?: AbortSignal) => Promise<CallToolResult>;
const elapsed = (start: number): number => Math.max(0, Math.round(performance.now() - start));

export function createRouter({ upstream, catalog, configurationId, audit, provider, config = configSchema.parse({ version: 1, upstream: { command: 'node' } }) }: RouterDependencies): ToolRouter {
  return async (params, signal) => {
    const started = performance.now();
    const correlationId = newCorrelationId();
    const validationStatus = catalog.validate(params.name, params.arguments);
    let upstreamOutcome: AuditEvent['upstreamOutcome'] = { status: 'NOT_ATTEMPTED' };
    const valid = validationStatus === 'VALID';
    const description = catalog.description(params.name);
    const sanitized = sanitize({ toolName: validationStatus === 'UNKNOWN_TOOL' ? '[UNKNOWN_TOOL]' : params.name,
      ...(description === undefined ? {} : { toolDescription: description }), ...(params.arguments === undefined ? {} : { arguments: params.arguments }) }, config.sanitization);
    let providerEvaluation: ProviderEvaluation | undefined;
    let policyDecision: AuditEvent['policyDecision'] = { outcome: 'DENY', source: 'VALIDATION', reasonCodes: [validationStatus], policyLatencyMs: 0, configurationId };
    const cancelBeforeDispatch = (): CallToolResult => {
      policyDecision = { outcome: 'DENY', source: 'CANCELLATION', reasonCodes: ['CALL_CANCELLED'],
        policyLatencyMs: policyDecision.policyLatencyMs, configurationId };
      upstreamOutcome = { status: 'NOT_ATTEMPTED', reasonCode: 'CALL_CANCELLED' };
      return gatewayError('ABORTED');
    };
    try {
      if (!valid) return policyError(policyDecision, correlationId);
      if (signal?.aborted) return cancelBeforeDispatch();
      const policyStarted = performance.now();
      let decision = evaluateBeforeProvider(config.policy, params.name, params.arguments, provider !== undefined);
      let policyLatencyMs = elapsed(policyStarted);
      if (!decision && provider) {
        providerEvaluation = await evaluateProvider(provider, sanitized, config.provider.timeoutMs, signal);
        if (signal?.aborted) return cancelBeforeDispatch();
        const finishStarted = performance.now();
        decision = evaluatePolicy(config.policy, providerEvaluation);
        policyLatencyMs += elapsed(finishStarted);
      }
      if (!decision) throw new Error('Missing deterministic decision');
      policyDecision = { ...decision, policyLatencyMs, configurationId };
      if (signal?.aborted) return cancelBeforeDispatch();
      if (policyDecision.outcome !== 'ALLOW') return policyError(policyDecision, correlationId);
      const upstreamStarted = performance.now();
      try {
        const result = await upstream.callTool(params, signal);
        upstreamOutcome = { status: result.isError ? 'TOOL_ERROR' : 'SUCCESS', latencyMs: elapsed(upstreamStarted) };
        return result;
      } catch (error) {
        upstreamOutcome = { status: signal?.aborted ? 'ABORTED' : error instanceof ProtocolError ? 'PROTOCOL_ERROR' : 'TRANSPORT_ERROR', latencyMs: elapsed(upstreamStarted) };
        return gatewayError(signal?.aborted ? 'ABORTED' : 'UPSTREAM_FAILURE');
      }
    } finally {
      // Only the sanitized copy crosses the audit boundary; results/errors remain ephemeral.
      audit({ schemaVersion: 1, eventId: randomUUID(), correlationId, occurredAt: new Date().toISOString(),
        toolName: sanitized.toolName, ...(sanitized.arguments === undefined ? {} : { sanitizedArguments: sanitized.arguments }), validationStatus,
        policyDecision, ...(providerEvaluation ? { providerEvaluation } : {}),
        upstreamOutcome, totalLatencyMs: elapsed(started), configurationId });
    }
  };
}
