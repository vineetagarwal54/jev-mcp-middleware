import type { DecisionProvider } from './DecisionProvider.js';
import type { ProviderEvaluation, SanitizedDecisionInput } from './types.js';
import { riskSignalsSchema } from './types.js';

export class MockDecisionProvider implements DecisionProvider {
  readonly id = 'mock';
  readonly calls: SanitizedDecisionInput[] = [];
  private readonly script: ProviderEvaluation[];
  constructor(script: readonly ProviderEvaluation[], private readonly clock: () => number = performance.now.bind(performance)) {
    this.script = structuredClone([...script]);
    for (const entry of this.script) if (entry.status === 'SUCCESS') riskSignalsSchema.parse(entry.signals);
  }
  async evaluate(input: SanitizedDecisionInput, { signal }: { readonly signal: AbortSignal }): Promise<ProviderEvaluation> {
    const start = this.clock();
    this.calls.push(structuredClone(input));
    if (signal.aborted) return { provider: this.id, status: 'ABORTED', latencyMs: Math.max(0, Math.round(this.clock() - start)), reasonCode: 'PROVIDER_ABORTED' };
    return structuredClone(this.script.shift() ?? { provider: this.id, status: 'INVALID', latencyMs: 0, reasonCode: 'PROVIDER_INTERNAL_ERROR' });
  }
}
