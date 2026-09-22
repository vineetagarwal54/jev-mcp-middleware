import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { sanitize } from '../security/sanitize.js';

const labels = z.strictObject({ destructive: z.boolean(), externalConsequence: z.boolean(), sensitive: z.boolean(), irreversible: z.boolean(), highImpact: z.boolean(), humanReview: z.boolean() });
const caseSchema = z.strictObject({ id: z.string().regex(/^[a-z0-9-]{1,64}$/), version: z.string().min(1), toolName: z.string().min(1), toolDescription: z.string(),
  arguments: z.record(z.string(), z.json()), labels, expectedOutcome: z.enum(['ALLOW', 'REVIEW', 'DENY']), tags: z.array(z.string()).default([]) });
export type BenchmarkCase = z.infer<typeof caseSchema>;
export interface Dataset { version: string; hash: string; cases: BenchmarkCase[] }
export async function loadDataset(path: string): Promise<Dataset> {
  try {
    const text = await readFile(path, 'utf8');
    const cases = text.split(/\r?\n/).filter(line => line.trim()).map(line => caseSchema.parse(JSON.parse(line)));
    const first = cases[0];
    if (!first || new Set(cases.map(c => c.id)).size !== cases.length || cases.some(c => c.version !== first.version)) throw new Error();
    for (const c of cases) {
      const input = { toolName: c.toolName, toolDescription: c.toolDescription, arguments: c.arguments };
      if (!isDeepStrictEqual(input, sanitize(input))) throw new Error();
    }
    return { version: first.version, hash: createHash('sha256').update(text).digest('hex'), cases };
  } catch { throw new Error('Invalid or unreadable benchmark dataset; use unique, labelled, non-secret cases'); }
}
