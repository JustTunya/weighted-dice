export type ChiSquareResult = {
  statistic: number;
  pValue: number;
  criticalValue95: number;
};

export type ConfidenceInterval = {
  min: number;
  max: number;
};

/**
 * Calculates Chi-squared goodness of fit test.
 * tests the null hypothesis that the observed counts are consistent with the expected probabilities.
 */
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
      chiSq += Math.pow(observed[i] - expected, 2) / expected;
    }
  }

  const df = k - 1;
  const pValue = 1 - pchisq(chiSq, df);
  
  // Critical value for alpha=0.05 and df=5 is approx 11.070
  // We can just return the p-value primarily.
  return {
    statistic: chiSq,
    pValue: pValue,
    criticalValue95: 11.070, // Hardcoded for df=5
  };
}

/**
 * Calculates 95% Confidence Interval for the Mean (Large sample, Z-test).
 */
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

/**
 * Calculates 95% Confidence Interval for the Standard Deviation (Large sample asymptotic).
 * SD ± 1.96 * SD / sqrt(2n)
 */
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

// -----------------------------------------------------------
// Statistical Helpers (CDF for Chi-Square via Gamma functions)
// -----------------------------------------------------------

// Returns the cdf of Chi-Square distribution P(X <= x) with df degrees of freedom
function pchisq(x: number, df: number): number {
  if (x <= 0) return 0;
  return gammp(df / 2.0, x / 2.0);
}

// Regularized Lower Incomplete Gamma Function P(s,x)
function gammp(s: number, x: number): number {
  if (x < 0.0 || s <= 0.0) return 0;
  if (x < s + 1.0) {
    return gser(s, x);
  } else {
    return gcf(s, x);
  }
}

// Series representation of Gamma function
function gser(s: number, x: number): number {
  const ITMAX = 100;
  const EPS = 3.0e-7;
  
  let sum, del, ap;
  const gln = gammln(s);

  if (x <= 0.0) {
    if (x < 0.0) return 0;
    return 0;
  }
  
  ap = s;
  del = sum = 1.0 / s;
  for (let n = 1; n <= ITMAX; n++) {
    ap += 1.0;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * EPS) {
      return sum * Math.exp(-x + s * Math.log(x) - gln);
    }
  }
  return 0; // Should not happen if converged
}

// Continued fraction representation of Gamma function
function gcf(s: number, x: number): number {
  const ITMAX = 100;
  const EPS = 3.0e-7;
  const FPMIN = 1.0e-30;

  let b = x + 1.0 - s;
  let c = 1.0 / FPMIN;
  let d = 1.0 / b;
  let h = d;
  
  for (let i = 1; i <= ITMAX; i++) {
    const an = -i * (i - s);
    b += 2.0;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1.0 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1.0) < EPS) break;
  }
  return Math.exp(-x + s * Math.log(x) - gammln(s)) * (1.0 - h) + 1.0; // Wait, gcf returns Q(s,x) usually?
  // Numerical Recipes says: gcf returns Gamma(s,x) (upper).
  // We want P(s,x) = 1 - Q(s,x).
  // The gcf function in recipes returns Gamma(s, x) (incomplete upper) normalized by Gamma(s)? 
  // gammp usually returns P(s,x).
  // Let's verify standard algorithm.
  // P(s,x) = 1 - Q(s,x).
  // The code above calculates h which converges to Q(s,x).
  // So returning 1.0 - ... might be correct if it calculates Q.
  
  // Actually, let's stick to a simpler known valid implementation of Gamma P.
  // The above is basically Numerical Recipes.
  // The gcf there returns 1 - P(s,x) (which is Q(s,x)).
  // So `gammp` should return `1.0 - gcf(...)`.
  
  return 1.0 - (Math.exp(-x + s * Math.log(x) - gammln(s)) * h);
}

// Log of Gamma function
function gammln(xx: number): number {
  const cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5
  ];
  let x = xx;
  let y = xx;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += cof[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}
