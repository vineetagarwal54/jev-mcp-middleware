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

const metadata = {
  provider: z.string().regex(/^[a-zA-Z0-9_.-]{1,64}$/), latencyMs: z.number().int().min(0),
  requestId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/).optional(), model: z.string().regex(/^[a-zA-Z0-9_.:/-]{1,128}$/).optional(),
  usage: z.strictObject({ inputTokens: z.number().int().min(0), outputTokens: z.number().int().min(0) }).optional(),
  reasonCode: z.enum(['PROVIDER_TIMEOUT', 'PROVIDER_UNAVAILABLE', 'PROVIDER_INVALID_RESPONSE', 'PROVIDER_ABORTED', 'PROVIDER_INTERNAL_ERROR']).optional(),
};
export const providerEvaluationSchema = z.discriminatedUnion('status', [
  z.strictObject({ ...metadata, status: z.literal('SUCCESS'), signals: riskSignalsSchema }),
  z.strictObject({ ...metadata, status: z.enum(['TIMEOUT', 'UNAVAILABLE', 'INVALID', 'ABORTED']) }),
]);
