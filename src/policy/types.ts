import type { GatewayConfig } from '../config/schema.js';
import type { AuditEvent } from '../audit/AuditEvent.js';

export type PolicyConfig = GatewayConfig['policy'];
export type Outcome = 'ALLOW' | 'REVIEW' | 'DENY';
export type PolicyDecision = AuditEvent['policyDecision'];
export type PolicyResult = Omit<PolicyDecision, 'policyLatencyMs' | 'configurationId'>;
export type HardRule = PolicyConfig['hardRules'][number];
