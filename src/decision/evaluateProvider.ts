import type { DecisionProvider } from './DecisionProvider.js';
import { providerEvaluationSchema, type ProviderEvaluation, type SanitizedDecisionInput } from './types.js';

/** A provider cannot bypass deadlines, inject audit fields, or choose policy outcomes. */
export async function evaluateProvider(provider: DecisionProvider, input: SanitizedDecisionInput, timeoutMs: number, signal?: AbortSignal): Promise<ProviderEvaluation> {
  const started = performance.now();
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) controller.abort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const failure = (status: 'TIMEOUT' | 'ABORTED' | 'INVALID'): ProviderEvaluation => ({ provider: provider.id, status,
    latencyMs: Math.max(0, Math.round(performance.now() - started)), reasonCode: status === 'INVALID' ? 'PROVIDER_INTERNAL_ERROR' : `PROVIDER_${status}` });
  try {
    if (controller.signal.aborted) return failure('ABORTED');
    const aborted = new Promise<ProviderEvaluation>(resolve => {
      onAbort = () => resolve(failure(signal?.aborted ? 'ABORTED' : 'TIMEOUT'));
      controller.signal.addEventListener('abort', onAbort, { once: true });
      timer = setTimeout(() => controller.abort(), timeoutMs);
    });
    const evaluated = Promise.resolve().then(() => provider.evaluate(input, { signal: controller.signal }))
      .then(result => {
        const parsed = providerEvaluationSchema.parse(result);
        const metadata = { provider: parsed.provider, latencyMs: parsed.latencyMs,
          ...(parsed.requestId === undefined ? {} : { requestId: parsed.requestId }),
          ...(parsed.model === undefined ? {} : { model: parsed.model }),
          ...(parsed.usage === undefined ? {} : { usage: parsed.usage }),
          ...(parsed.reasonCode === undefined ? {} : { reasonCode: parsed.reasonCode }) };
        return parsed.status === 'SUCCESS' ? { ...metadata, status: parsed.status, signals: parsed.signals } : { ...metadata, status: parsed.status };
      }).catch(() => failure('INVALID'));
    return await Promise.race([evaluated, aborted]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
    if (onAbort) controller.signal.removeEventListener('abort', onAbort);
  }
}
