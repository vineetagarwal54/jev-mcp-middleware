import { isDeepStrictEqual } from 'node:util';
import type { HardRule } from './types.js';

/** Bounded wildcard matcher: only * and ? have special meaning; no regex input. */
export function matchesGlob(pattern: string, value: string): boolean {
  let row = Array<boolean>(value.length + 1).fill(false);
  row[0] = true;
  for (const char of pattern) {
    const next = Array<boolean>(value.length + 1).fill(false);
    next[0] = char === '*' && row[0] === true;
    for (let j = 1; j <= value.length; j++) next[j] = char === '*' ? Boolean(row[j] || next[j - 1]) : Boolean(row[j - 1] && (char === '?' || char === value[j - 1]));
    row = next;
  }
  return row[value.length] === true;
}
function atPointer(root: unknown, pointer: string): { exists: boolean; value?: unknown } {
  let value = root;
  if (!pointer) return { exists: root !== undefined, value };
  for (const token of pointer.slice(1).split('/').map(p => p.replace(/~1/g, '/').replace(/~0/g, '~'))) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, token)) return { exists: false };
    value = (value as Record<string, unknown>)[token];
  }
  return { exists: true, value };
}
export function matchHardRule(rules: readonly HardRule[], name: string, args: unknown): HardRule | undefined {
  const rank = { ALLOW: 0, REVIEW: 1, DENY: 2 };
  let winner: HardRule | undefined;
  for (const rule of rules) {
    if (!matchesGlob(rule.tool, name) || !rule.arguments.every(predicate => {
      const selected = atPointer(args, predicate.pointer);
      switch (predicate.operator) {
        case 'exists': return selected.exists === predicate.value;
        case 'equals': return selected.exists && isDeepStrictEqual(selected.value, predicate.value);
        case 'oneOf': return selected.exists && predicate.value.some(v => isDeepStrictEqual(v, selected.value));
        case 'glob': return typeof selected.value === 'string' && matchesGlob(predicate.value, selected.value);
      }
    })) continue;
    if (!winner || rank[rule.outcome] > rank[winner.outcome]) winner = rule;
  }
  return winner;
}
