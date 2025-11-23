export function normalizeWeights(weights: number[]): number[] {
  const sum = weights.reduce((acc, w) => acc + w, 0);
  if (sum <= 0) {
    throw new Error("Sum of weights must be > 0");
  }
  return weights.map(w => w / sum);
}

export function rollWeightedDie(weights: number[]): number {
  const p = normalizeWeights(weights);
  const u = Math.random();
  
  let cumulative = 0;
  for (let i = 0; i < p.length; i++) {
    cumulative += p[i];
    if (u <= cumulative) {
      return i;
    }
  }

  return p.length - 1;
}

export function simulateRolls(weights: number[], n: number, sampleStep = 10) {
  const k = weights.length;
  const counts = Array(k).fill(0) as number[];
  const runningMean: number[] = [];
  const probs = normalizeWeights(weights);
  let sum = 0;

  for (let i = 0; i < n; i++) {
    const idx = rollWeightedDie(weights);
    counts[idx]++;
    sum += idx + 1;
    if ((i + 1) % sampleStep === 0 || i === n - 1) {
      runningMean.push(sum / (i + 1));
    }
  }

  const relFreq = counts.map(c => c / n);

  return { counts, relFreq, probs, runningMean, sampleStep };
}

export function weightsFromDimensions(dimensions: { lx: number; ly: number; lz: number }, exponent: number): number[] {
  const clean = {
    lx: Math.max(dimensions.lx, 0.01),
    ly: Math.max(dimensions.ly, 0.01),
    lz: Math.max(dimensions.lz, 0.01),
  };

  const areaXY = clean.lx * clean.ly;
  const areaYZ = clean.ly * clean.lz;
  const areaZX = clean.lz * clean.lx;

  const scale = (a: number) => Math.pow(a, exponent);

  return [
    scale(areaXY), // Face 1
    scale(areaYZ), // Face 2
    scale(areaZX), // Face 3
    scale(areaZX), // Face 4
    scale(areaYZ), // Face 5
    scale(areaXY), // Face 6
  ];
}

export function dimensionsFromWeights(weights: number[], exponent: number): { lx: number; ly: number; lz: number } {
  const w1 = Math.max(weights[0], 0.0001);
  const w2 = Math.max(weights[1], 0.0001);
  const w3 = Math.max(weights[2], 0.0001);
  const w4 = Math.max(weights[3], 0.0001);
  const w5 = Math.max(weights[4], 0.0001);
  const w6 = Math.max(weights[5], 0.0001);

  const invScale = (w: number) => Math.pow(w, 1 / exponent);

  const areaXY = Math.sqrt(invScale(w1) * invScale(w6));
  const areaYZ = Math.sqrt(invScale(w2) * invScale(w5));
  const areaZX = Math.sqrt(invScale(w3) * invScale(w4));

  const ly = Math.sqrt((areaXY * areaYZ) / areaZX);
  const lx = areaXY / ly;
  const lz = areaZX / lx;

  return { lx, ly, lz };
}