export function classificationMetrics(expected: readonly boolean[], predicted: readonly boolean[]) {
  if (expected.length !== predicted.length) throw new Error('Mismatched classification samples');
  let truePositive = 0, trueNegative = 0, falsePositive = 0, falseNegative = 0;
  expected.forEach((label, i) => {
    if (label && predicted[i]) truePositive++;
    else if (label) falseNegative++;
    else if (predicted[i]) falsePositive++;
    else trueNegative++;
  });
  const precision = truePositive / (truePositive + falsePositive) || 0;
  const recall = truePositive / (truePositive + falseNegative) || 0;
  return { truePositive, trueNegative, falsePositive, falseNegative, precision, recall, f1: 2 * precision * recall / (precision + recall) || 0 };
}
export function macroF1(metrics: Record<string, { f1: number }>): number {
  const values = Object.values(metrics);
  return values.length ? values.reduce((sum, metric) => sum + metric.f1, 0) / values.length : 0;
}
export function percentiles(values: readonly number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p: number) => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] ?? 0;
  return { p50: rank(0.5), p95: rank(0.95), p99: rank(0.99) };
}
