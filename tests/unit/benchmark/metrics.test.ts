import { expect, it } from 'vitest';
import { classificationMetrics, percentiles, macroF1 } from '../../../src/benchmark/metrics.js';

it('computes confusion counts, zero-safe precision/recall/F1 and macro F1', () => {
  const scores = classificationMetrics([true, true, false, false], [true, false, true, false]);
  expect(scores).toEqual({ truePositive: 1, trueNegative: 1, falsePositive: 1, falseNegative: 1, precision: 0.5, recall: 0.5, f1: 0.5 });
  expect(classificationMetrics([true], [false]).f1).toBe(0);
  expect(classificationMetrics([], []).precision).toBe(0);
  expect(macroF1({ a: scores, b: { ...scores, f1: 1 } })).toBe(0.75);
});
it('uses nearest-rank latency percentiles without mutating samples', () => {
  const values = [4, 1, 3, 2];
  expect(percentiles(values)).toEqual({ p50: 2, p95: 4, p99: 4 });
  expect(values).toEqual([4, 1, 3, 2]);
  expect(percentiles([])).toEqual({ p50: 0, p95: 0, p99: 0 });
});
