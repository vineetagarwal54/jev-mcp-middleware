import { TypeSafeClient, noul, APITimeoutError, APIUserAbortError, APIError, APIConnectionError, type SystemOneRequest, type RequestOptions } from '@typesafe-ai/sdk';
import { z } from 'zod';
import type { JevProviderConfig } from '../config/schema.js';
import type { DecisionProvider } from './DecisionProvider.js';
import type { ProviderEvaluation, SanitizedDecisionInput } from './types.js';
import { sanitizedInputSchema } from '../security/sanitize.js';
import { createRiskQuestions } from './riskQuestions.js';

export interface JevClient { systemOne(request: SystemOneRequest, options: RequestOptions): Promise<unknown> }
const questions = createRiskQuestions(noul);
const answer = z.object({ type: z.literal('noul'), noul: z.number().min(0).max(1) });
const responseSchema = z.object({
  model: z.string().regex(/^[a-zA-Z0-9_.:/-]{1,128}$/),
  usage: z.object({ input_tokens: z.number().int().min(0), output_tokens: z.number().int().min(0) }),
  answers: z.object({ destructive: answer, external_consequence: answer, sensitive: answer, irreversible: answer, high_impact: answer, human_review: answer }),
});
export class JevDecisionProvider implements DecisionProvider {
  readonly id = 'jev';
  private readonly client: JevClient;
  constructor(private readonly config: JevProviderConfig, client?: JevClient) {
    if (client) { this.client = client; return; }
    const apiKey = process.env.TYPESAFE_API_KEY?.trim();
    if (!apiKey) throw new Error('Jev requires TYPESAFE_API_KEY');
    this.client = new TypeSafeClient({ apiKey, baseURL: 'https://api.typesafe.ai', defaultModel: config.model,
      logLevel: 'off', timeout: config.timeoutMs, retry: { maxRetries: config.retry.maxRetries,
        backoffInitialMs: config.retry.initialDelayMs, backoffMaxMs: config.retry.maxDelayMs,
        backoffJitter: 0, respectRetryAfter: false, maxRetryAfterMs: config.retry.maxDelayMs,
        httpStatuses: new Set([408, 429, 500, 502, 503, 504]), apiConnectionError: true, apiTimeoutError: false } });
  }
  async evaluate(input: SanitizedDecisionInput, { signal }: { readonly signal: AbortSignal }): Promise<ProviderEvaluation> {
    const started = performance.now();
    const latency = () => Math.max(0, Math.round(performance.now() - started));
    try {
      const validated = sanitizedInputSchema.parse(input);
      const state = { toolName: validated.toolName,
        ...(validated.toolDescription === undefined ? {} : { toolDescription: validated.toolDescription }),
        ...(validated.arguments === undefined ? {} : { arguments: validated.arguments }) };
      const raw = await this.client.systemOne({ state, questions, model: this.config.model }, { signal });
      const parsed = responseSchema.safeParse(raw);
      if (!parsed.success) return { provider: this.id, status: 'INVALID', latencyMs: latency(), reasonCode: 'PROVIDER_INVALID_RESPONSE' };
      const { answers: a, model, usage } = parsed.data;
      return { provider: this.id, status: 'SUCCESS', latencyMs: latency(), model,
        signals: { destructive: a.destructive.noul, externalConsequence: a.external_consequence.noul, sensitive: a.sensitive.noul,
          irreversible: a.irreversible.noul, highImpact: a.high_impact.noul, humanReview: a.human_review.noul },
        usage: { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens } };
    } catch (error) {
      const status = signal.aborted || error instanceof APIUserAbortError ? 'ABORTED' : error instanceof APITimeoutError ? 'TIMEOUT'
        : error instanceof APIError || error instanceof APIConnectionError ? 'UNAVAILABLE' : 'INVALID';
      return { provider: this.id, status, latencyMs: latency(), reasonCode: status === 'INVALID' ? 'PROVIDER_INVALID_RESPONSE' : `PROVIDER_${status}` };
    }
  }
}
