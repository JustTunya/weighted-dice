import chiSquareCDF from "@stdlib/stats-base-dists-chisquare-cdf";

export type ChiSquareResult = {
  statistic: number;
  pValue: number;
  criticalValue95: number;
};

export type ConfidenceInterval = {
  min: number;
  max: number;
};

export function calculateChiSquare(
  observed: number[],
  expectedProbs: number[],
  nTotal: number
): ChiSquareResult {
  const k = observed.length;
  let chiSq = 0;

  for (let i = 0; i < k; i++) {
    const expected = expectedProbs[i] * nTotal;
    if (expected > 0) {
      chiSq += ((observed[i] - expected) ** 2) / expected;
    }
  }

  const df = k - 1;
  const pValue = 1 - chiSquareCDF(chiSq, df);

  return {
    statistic: chiSq,
    pValue,
    criticalValue95: 11.070,
  };
}

export function calculateMeanCI(
  mean: number,
  stdDev: number,
  n: number
): ConfidenceInterval {
  const z = 1.96; // 95% confidence
  const margin = z * (stdDev / Math.sqrt(n));
  return {
    min: mean - margin,
    max: mean + margin,
  };
}

export function calculateStdDevCI(
  stdDev: number,
  n: number
): ConfidenceInterval {
  const z = 1.96;
  const margin = z * (stdDev / Math.sqrt(2 * n));
  return {
    min: stdDev - margin,
    max: stdDev + margin,
  };
}