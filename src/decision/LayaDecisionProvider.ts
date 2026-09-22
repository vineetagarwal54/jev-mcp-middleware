import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { LayaConfig } from '@receptron/laya';
import type { DecisionProvider } from './DecisionProvider.js';
import { createRiskQuestions } from './riskQuestions.js';
import type { ProviderEvaluation, SanitizedDecisionInput } from './types.js';
import { sanitizedInputSchema } from '../security/sanitize.js';

const createLayaQuestions = () => createRiskQuestions(instructions => ({ type: 'noul' as const, instructions }));
type LayaQuestionSet = ReturnType<typeof createLayaQuestions>;
export interface LayaClient {
  systemOne(state: unknown, questions: LayaQuestionSet): Promise<unknown>;
}
export type LayaContextCheck = (state: SanitizedDecisionInput) => boolean;

const questions = createLayaQuestions();
const answer = z.object({ type: z.literal('noul'), noul: z.number().min(0).max(1) });
const responseSchema = z.object({
  model: z.string().regex(/^[a-zA-Z0-9_.:/-]{1,128}$/),
  usage: z.object({ input_tokens: z.number().int().min(0), output_tokens: z.number().int().min(0) }),
  answers: z.object({ destructive: answer, external_consequence: answer, sensitive: answer,
    irreversible: answer, high_impact: answer, human_review: answer }),
});

export class LayaDecisionProvider implements DecisionProvider {
  readonly id = 'laya';
  constructor(private readonly client: LayaClient, private readonly fitsContext: LayaContextCheck) {}

  async evaluate(input: SanitizedDecisionInput, { signal }: { readonly signal: AbortSignal }): Promise<ProviderEvaluation> {
    const started = performance.now();
    const latency = () => Math.max(0, Math.round(performance.now() - started));
    if (signal.aborted) return { provider: this.id, status: 'ABORTED', latencyMs: latency(), reasonCode: 'PROVIDER_ABORTED' };
    let state: SanitizedDecisionInput;
    try {
      const validated = sanitizedInputSchema.parse(input);
      state = { toolName: validated.toolName,
        ...(validated.toolDescription === undefined ? {} : { toolDescription: validated.toolDescription }),
        ...(validated.arguments === undefined ? {} : { arguments: validated.arguments }) };
    } catch {
      return { provider: this.id, status: 'INVALID', latencyMs: latency(), reasonCode: 'PROVIDER_INVALID_RESPONSE' };
    }
    try {
      if (!this.fitsContext(state)) return { provider: this.id, status: 'INVALID', latencyMs: latency(), reasonCode: 'PROVIDER_CONTEXT_LIMIT' };
    } catch {
      return { provider: this.id, status: 'INVALID', latencyMs: latency(), reasonCode: 'PROVIDER_CONTEXT_LIMIT' };
    }
    try {
      const raw = await this.client.systemOne(state, questions);
      if (signal.aborted) return { provider: this.id, status: 'ABORTED', latencyMs: latency(), reasonCode: 'PROVIDER_ABORTED' };
      const parsed = responseSchema.safeParse(raw);
      if (!parsed.success) return { provider: this.id, status: 'INVALID', latencyMs: latency(), reasonCode: 'PROVIDER_INVALID_RESPONSE' };
      const { answers: values, model, usage } = parsed.data;
      return { provider: this.id, status: 'SUCCESS', latencyMs: latency(), model,
        signals: { destructive: values.destructive.noul, externalConsequence: values.external_consequence.noul,
          sensitive: values.sensitive.noul, irreversible: values.irreversible.noul,
          highImpact: values.high_impact.noul, humanReview: values.human_review.noul },
        usage: { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens } };
    } catch {
      const status = signal.aborted ? 'ABORTED' : 'UNAVAILABLE';
      return { provider: this.id, status, latencyMs: latency(), reasonCode: status === 'ABORTED' ? 'PROVIDER_ABORTED' : 'PROVIDER_UNAVAILABLE' };
    }
  }
}

function pythonJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return `[${value.map(pythonJson).join(', ')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .map(([key, entry]) => `${JSON.stringify(key)}: ${pythonJson(entry)}`).join(', ')}}`;
}

export async function createLayaContextCheck(modelDir: string, config: Pick<LayaConfig, 'max_len' | 'head_max_len'>): Promise<LayaContextCheck> {
  const stateBudget = config.max_len - config.head_max_len - 4;
  if (!Number.isInteger(stateBudget) || stateBudget <= 0) throw new Error('Invalid Laya context configuration');
  const [{ Tokenizer }, tokenizerJson, tokenizerConfig] = await Promise.all([
    import('@huggingface/tokenizers'),
    readFile(join(modelDir, 'tokenizer', 'tokenizer.json'), 'utf8').then(JSON.parse),
    readFile(join(modelDir, 'tokenizer', 'tokenizer_config.json'), 'utf8').then(JSON.parse),
  ]);
  const tokenizer = new Tokenizer(tokenizerJson as object, tokenizerConfig as object);
  return state => tokenizer.encode(pythonJson(state).split('[MASK]').join(' '), { add_special_tokens: false }).ids.length <= stateBudget;
}
