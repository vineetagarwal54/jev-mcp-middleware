import type { ProviderEvaluation, JsonValue } from '../decision/types.js';

export interface AuditEvent {
  readonly schemaVersion: 1;
  readonly eventId: string;
  readonly correlationId: string;
  readonly occurredAt: string;
  readonly toolName: string;
  readonly validationStatus: 'VALID' | 'MALFORMED_REQUEST' | 'UNKNOWN_TOOL' | 'INVALID_ARGUMENTS';
  readonly sanitizedArguments?: Readonly<Record<string, JsonValue>>;
  readonly providerEvaluation?: ProviderEvaluation;
  readonly policyDecision: {
    readonly outcome: 'ALLOW' | 'REVIEW' | 'DENY';
    readonly source: 'VALIDATION' | 'HARD_RULE' | 'SEMANTIC_THRESHOLDS' | 'NO_PROVIDER' | 'PROVIDER_FAILURE';
    readonly reasonCodes: readonly string[];
    readonly policyLatencyMs: number;
    readonly configurationId: string;
    readonly hardRuleId?: string;
    readonly failureBehavior?: 'ALLOW' | 'REVIEW' | 'DENY';
  };
  readonly upstreamOutcome: {
    readonly status: 'NOT_ATTEMPTED' | 'SUCCESS' | 'TOOL_ERROR' | 'PROTOCOL_ERROR' | 'TRANSPORT_ERROR' | 'ABORTED';
    readonly latencyMs?: number;
    readonly reasonCode?: string;
  };
  readonly totalLatencyMs: number;
  readonly configurationId: string;
}
