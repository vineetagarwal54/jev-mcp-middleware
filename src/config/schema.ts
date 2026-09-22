import { z } from 'zod';

const outcome = z.enum(['ALLOW', 'REVIEW', 'DENY']);
const bounded = (max: number) => z.number().int().min(1).max(max);
const pattern = z.string().min(1).max(256);
const pointer = z.string().regex(/^(\/(?:[^~]|~[01])*)*$/);
const predicate = z.discriminatedUnion('operator', [
  z.strictObject({ pointer, operator: z.literal('exists'), value: z.boolean() }),
  z.strictObject({ pointer, operator: z.literal('equals'), value: z.json() }),
  z.strictObject({ pointer, operator: z.literal('oneOf'), value: z.array(z.json()).min(1) }),
  z.strictObject({ pointer, operator: z.literal('glob'), value: pattern }),
]);
const threshold = z.number().min(0).max(1).nullable();
const thresholds = z.strictObject({ destructive: threshold, externalConsequence: threshold, sensitive: threshold, irreversible: threshold, highImpact: threshold, humanReview: threshold });
const allThresholds = (value: number) => ({ destructive: value, externalConsequence: value, sensitive: value, irreversible: value, highImpact: value, humanReview: value });
const providerTimeout = bounded(60000);
const retrySchema = z.strictObject({
  maxRetries: z.number().int().min(0).max(5).default(0),
  initialDelayMs: bounded(60000).default(500),
  maxDelayMs: bounded(60000).default(5000),
}).refine(retry => retry.maxDelayMs >= retry.initialDelayMs).prefault({});
const noProviderSchema = z.strictObject({
  type: z.enum(['none', 'mock']).default('none'),
  model: z.string().min(1).default('jev-latest'),
  timeoutMs: providerTimeout.default(3000),
  retry: retrySchema,
});
export const jevProviderSchema = z.strictObject({
  type: z.literal('jev'),
  model: z.string().min(1).default('jev-latest'),
  timeoutMs: providerTimeout.default(3000),
  retry: retrySchema,
});
export const layaProviderSchema = z.strictObject({
  type: z.literal('laya'),
  timeoutMs: providerTimeout.default(10000),
  modelDir: z.string().min(1).optional(),
  cacheDir: z.string().min(1).optional(),
  subfolder: z.string().min(1).optional(),
  revision: z.string().min(1).optional(),
}).refine(config => config.modelDir === undefined ||
  (config.cacheDir === undefined && config.subfolder === undefined && config.revision === undefined));
const providerSchema = z.union([jevProviderSchema, layaProviderSchema, noProviderSchema]).prefault({});
export const configSchema = z.strictObject({
  version: z.literal(1),
  upstream: z.strictObject({
    transport: z.literal('stdio').default('stdio'), command: z.string().min(1), args: z.array(z.string()).default([]), cwd: z.string().min(1).default('.'),
    envPassthrough: z.array(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/)).refine(names => new Set(names).size === names.length).default([]),
    requestTimeoutMs: bounded(300000).default(30000),
  }),
  provider: providerSchema,
  policy: z.strictObject({
    noProviderOutcome: outcome.default('ALLOW'), providerFailureOutcome: outcome.default('DENY'),
    semanticEligibility: z.strictObject({ includeTools: z.array(pattern).default(['*']), excludeTools: z.array(pattern).default([]) }).prefault({}),
    hardRules: z.array(z.strictObject({ id: z.string().min(1), description: z.string().optional(), tool: pattern, arguments: z.array(predicate).default([]), outcome }))
      .refine(rules => new Set(rules.map(r => r.id)).size === rules.length).default([]),
    thresholds: z.strictObject({ review: thresholds.default(allThresholds(0.5)), deny: thresholds.default({ ...allThresholds(0.9), humanReview: null }) })
      .refine(t => (Object.keys(t.review) as (keyof typeof t.review)[]).every(k => t.review[k] === null || t.deny[k] === null || t.deny[k]! >= t.review[k]!)).prefault({}),
  }).prefault({}),
  sanitization: z.strictObject({ redactKeys: z.array(z.string().min(1)).default(['authorization', 'password', 'secret', 'token', 'apiKey', 'credential']), maxDepth: bounded(50).default(20), maxStringLength: bounded(65536).default(4096), replacement: z.string().min(1).default('[REDACTED]') }).prefault({}),
  audit: z.strictObject({ sqlitePath: z.string().min(1).default('./data/audit.db'), busyTimeoutMs: bounded(60000).default(5000) }).prefault({}),
  logging: z.strictObject({ level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info') }).prefault({}),
  benchmark: z.strictObject({ datasetPath: z.string().min(1), resultsDirectory: z.string().min(1), seed: z.number().int().min(0).max(2147483647).default(1) }).optional(),
});
export type GatewayConfig = z.infer<typeof configSchema>;
export type JevProviderConfig = z.infer<typeof jevProviderSchema>;
export type LayaProviderConfig = z.infer<typeof layaProviderSchema>;
