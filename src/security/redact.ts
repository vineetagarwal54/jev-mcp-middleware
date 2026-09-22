import type { GatewayConfig } from '../config/schema.js';
import type { JsonValue } from '../decision/types.js';

export const defaultSanitization: GatewayConfig['sanitization'] = {
  redactKeys: [], maxDepth: 20, maxStringLength: 4096, replacement: '[REDACTED]',
};
const normalize = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');
const prohibited = ['authorization', 'proxyauthorization', 'password', 'passwd', 'secret', 'token', 'apikey', 'credential', 'credentials', 'headers', 'env', 'environment', 'environmentvariables', 'cookie', 'setcookie', 'privatekey', 'clientsecret', 'accesstoken', 'refreshtoken'];
export function redactString(value: string, options = defaultSanitization): string {
  if (value.length > options.maxStringLength) return options.replacement;
  return value
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/g, () => options.replacement)
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9+/_.=:-]+/gi, () => options.replacement)
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, () => options.replacement)
    .replace(/\b(?:sk-|ghp_|github_pat_|AKIA)[A-Za-z0-9_-]{8,}/g, () => options.replacement)
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, (_match, scheme: string) => `${scheme}${options.replacement}@`)
    .replace(/\b(?:api[_-]?key|password|secret|access[_-]?token|token)\s*[=:]\s*["']?[^\s&"',;}]+/gi, () => options.replacement);
}
export function redact(value: unknown, options = defaultSanitization): JsonValue {
  const keys = new Set([...prohibited, ...options.redactKeys].map(normalize));
  const seen = new WeakSet<object>();
  let remaining = 10000;
  const visit = (input: unknown, depth: number): JsonValue => {
    if (--remaining < 0 || depth > options.maxDepth) return options.replacement;
    if (typeof input === 'string') return redactString(input, options);
    if (input === null || typeof input === 'boolean') return input;
    if (typeof input === 'number') return Number.isFinite(input) ? input : options.replacement;
    if (typeof input !== 'object' || seen.has(input)) return options.replacement;
    seen.add(input);
    if (Array.isArray(input)) return input.slice(0, 10000).map(item => visit(item, depth + 1));
    return Object.fromEntries(Object.entries(input).slice(0, 10000).map(([key, item]) => [
      redactString(key, options), keys.has(normalize(key)) || /(?:password|secret|token|credential|apikey)$/.test(normalize(key)) ? options.replacement : visit(item, depth + 1),
    ]));
  };
  return visit(value, 0);
}
