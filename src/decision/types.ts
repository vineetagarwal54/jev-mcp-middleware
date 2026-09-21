import { z } from 'zod';

export type JsonValue = null | boolean | number | string | JsonValue[] | { readonly [key: string]: JsonValue };
export interface SanitizedDecisionInput {
  readonly toolName: string;
  readonly toolDescription?: string;
  readonly arguments?: Readonly<Record<string, JsonValue>>;
}
const probability = z.number().min(0).max(1);
export const riskSignalsSchema = z.strictObject({
  destructive: probability, externalConsequence: probability, sensitive: probability,
  irreversible: probability, highImpact: probability, humanReview: probability,
});
export type RiskSignals = z.infer<typeof riskSignalsSchema>;
export type ProviderStatus = 'SUCCESS' | 'TIMEOUT' | 'UNAVAILABLE' | 'INVALID' | 'ABORTED';
interface EvaluationMetadata {
  readonly provider: string;
  readonly latencyMs: number;
  readonly requestId?: string;
  readonly model?: string;
  readonly usage?: { readonly inputTokens: number; readonly outputTokens: number };
  readonly reasonCode?: string;
}
export type ProviderEvaluation = EvaluationMetadata & (
  | { readonly status: 'SUCCESS'; readonly signals: RiskSignals }
  | { readonly status: Exclude<ProviderStatus, 'SUCCESS'>; readonly signals?: never }
);
