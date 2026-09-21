import { randomUUID } from 'node:crypto';
import { ProtocolError, type CallToolRequestParams, type CallToolResult } from '@modelcontextprotocol/server';
import type { AuditEvent } from '../audit/AuditEvent.js';
import { newCorrelationId } from '../logging/logger.js';
import type { ToolCatalog } from './toolCatalog.js';
import type { UpstreamClient } from './upstreamClient.js';

interface RouterDependencies {
  readonly upstream: UpstreamClient;
  readonly catalog: ToolCatalog;
  readonly configurationId: string;
  readonly audit: (event: AuditEvent) => void;
}
export type ToolRouter = (params: CallToolRequestParams, signal?: AbortSignal) => Promise<CallToolResult>;
const elapsed = (start: number): number => Math.max(0, Math.round(performance.now() - start));

/** US1 only: startup explicitly restricts this route to provider:none and no hard rules. */
export function createRouter({ upstream, catalog, configurationId, audit }: RouterDependencies): ToolRouter {
  return async (params, signal) => {
    const started = performance.now();
    const correlationId = newCorrelationId();
    const validationStatus = catalog.validate(params.name, params.arguments);
    let upstreamOutcome: AuditEvent['upstreamOutcome'] = { status: 'NOT_ATTEMPTED' };
    const valid = validationStatus === 'VALID';
    try {
      if (!valid) return { isError: true, content: [{ type: 'text', text: 'Invalid tool call.' }] };
      if (signal?.aborted) return { isError: true, content: [{ type: 'text', text: 'Call cancelled.' }] };
      const upstreamStarted = performance.now();
      try {
        const result = await upstream.callTool(params, signal);
        upstreamOutcome = { status: result.isError ? 'TOOL_ERROR' : 'SUCCESS', latencyMs: elapsed(upstreamStarted) };
        return result;
      } catch (error) {
        upstreamOutcome = { status: signal?.aborted ? 'ABORTED' : error instanceof ProtocolError ? 'PROTOCOL_ERROR' : 'TRANSPORT_ERROR', latencyMs: elapsed(upstreamStarted) };
        return { isError: true, content: [{ type: 'text', text: 'Upstream call failed.' }] };
      }
    } finally {
      // Raw arguments, result content and exception text are deliberately absent.
      audit({ schemaVersion: 1, eventId: randomUUID(), correlationId, occurredAt: new Date().toISOString(),
        toolName: validationStatus === 'UNKNOWN_TOOL' ? '[UNKNOWN_TOOL]' : params.name, validationStatus,
        policyDecision: { outcome: valid ? 'ALLOW' : 'DENY', source: valid ? 'NO_PROVIDER' : 'VALIDATION',
          reasonCodes: [valid ? 'NO_PROVIDER' : validationStatus], policyLatencyMs: 0, configurationId },
        upstreamOutcome, totalLatencyMs: elapsed(started), configurationId });
    }
  };
}
