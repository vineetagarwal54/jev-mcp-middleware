import type { ProviderEvaluation, SanitizedDecisionInput } from './types.js';

/** Providers report advisory signals; only deterministic policy may choose an outcome. */
export interface DecisionProvider {
  readonly id: string;
  evaluate(input: SanitizedDecisionInput, options: { readonly signal: AbortSignal }): Promise<ProviderEvaluation>;
}
