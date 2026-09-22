import type { CallToolResult } from '@modelcontextprotocol/server';
import type { PolicyDecision } from '../policy/types.js';

export function policyError(decision: PolicyDecision, correlationId: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: decision.outcome === 'REVIEW'
    ? 'Tool call requires human review; interactive approval is unavailable in v0.1.' : 'Tool call denied by gateway policy.' }],
  _meta: { 'dev.jev-mcp-middleware/decision': { schemaVersion: 1, outcome: decision.outcome, correlationId, reasonCodes: decision.reasonCodes } } };
}
export function gatewayError(reason: 'UPSTREAM_FAILURE' | 'ABORTED'): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: reason === 'ABORTED' ? 'Call cancelled.' : 'Upstream call failed.' }] };
}
