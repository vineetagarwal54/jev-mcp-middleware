import { z } from 'zod';
import type { SanitizedDecisionInput } from '../decision/types.js';
import { defaultSanitization, redact, redactString } from './redact.js';

export const sanitizedInputSchema = z.strictObject({ toolName: z.string().min(1), toolDescription: z.string().optional(), arguments: z.record(z.string(), z.json()).optional() });
export function sanitize(input: { toolName: string; toolDescription?: string; arguments?: unknown }, options = defaultSanitization): SanitizedDecisionInput {
  const args = input.arguments === undefined ? undefined : redact(input.arguments, options);
  const result: SanitizedDecisionInput = {
    toolName: redactString(input.toolName, options),
    ...(input.toolDescription === undefined ? {} : { toolDescription: redactString(input.toolDescription, options) }),
    ...(args === undefined ? {} : { arguments: args !== null && typeof args === 'object' && !Array.isArray(args) ? args : { redacted: options.replacement } }),
  };
  sanitizedInputSchema.parse(result);
  return result;
}
