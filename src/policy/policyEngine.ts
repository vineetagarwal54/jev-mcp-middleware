import type { ProviderEvaluation } from '../decision/types.js';
import { matchesGlob, matchHardRule } from './hardRules.js';
import type { PolicyConfig, PolicyResult } from './types.js';

export function evaluateBeforeProvider(config: PolicyConfig, name: string, args: unknown, hasProvider: boolean): PolicyResult | undefined {
  const rule = matchHardRule(config.hardRules, name, args);
  if (rule) return { outcome: rule.outcome, source: 'HARD_RULE', reasonCodes: [`HARD_RULE_${rule.outcome}`], hardRuleId: rule.id };
  const { includeTools, excludeTools } = config.semanticEligibility;
  if (!hasProvider || !includeTools.some(p => matchesGlob(p, name)) || excludeTools.some(p => matchesGlob(p, name))) {
    return { outcome: config.noProviderOutcome, source: 'NO_PROVIDER', reasonCodes: ['NO_PROVIDER'] };
  }
  return undefined;
}
export function evaluatePolicy(config: PolicyConfig, evaluation: ProviderEvaluation): PolicyResult {
  if (evaluation.status !== 'SUCCESS') return { outcome: config.providerFailureOutcome, source: 'PROVIDER_FAILURE', reasonCodes: ['PROVIDER_FAILURE'], failureBehavior: config.providerFailureOutcome };
  const names = Object.keys(evaluation.signals) as (keyof typeof evaluation.signals)[];
  for (const outcome of ['DENY', 'REVIEW'] as const) {
    const thresholds = config.thresholds[outcome === 'DENY' ? 'deny' : 'review'];
    if (names.some(name => thresholds[name] !== null && evaluation.signals[name] >= thresholds[name]!)) {
      return { outcome, source: 'SEMANTIC_THRESHOLDS', reasonCodes: [`SEMANTIC_${outcome}`] };
    }
  }
  return { outcome: 'ALLOW', source: 'SEMANTIC_THRESHOLDS', reasonCodes: ['SEMANTIC_ALLOW'] };
}
