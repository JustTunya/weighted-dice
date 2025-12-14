import type { BubbleConfig, Vec3 } from "@/types/bubble";

const FACE_NORMS: readonly Vec3[] = [
  { x: 0, y: 1, z: 0 },  // Face 1 (+Y)
  { x: 1, y: 0, z: 0 },  // Face 2 (+X)
  { x: 0, y: 0, z: 1 },  // Face 3 (+Z)
  { x: 0, y: 0, z: -1 }, // Face 4 (-Z)
  { x: -1, y: 0, z: 0 }, // Face 5 (-X)
  { x: 0, y: -1, z: 0 }, // Face 6 (-Y)
];

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function buildCDF(probs: number[]): number[] {
  const p = normalizeWeights(probs);
  const cdf = new Array(p.length);
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    s += p[i];
    cdf[i] = s;
  }
  cdf[cdf.length - 1] = 1;
  return cdf;
}

export function invBySeqSearch(cdf: number[], u: number): number {
  for (let i = 0; i < cdf.length; i++) {
    if (u <= cdf[i]) return i;
  }
  return cdf.length - 1;
}

export function clampBubbleToDie(
  bubble: BubbleConfig,
  die: { lx: number; ly: number; lz: number }
): BubbleConfig {
  if (!bubble.enabled) return bubble;

  const lx = Math.max(die.lx, 0.01);
  const ly = Math.max(die.ly, 0.01);
  const lz = Math.max(die.lz, 0.01);

  const hx = lx / 2;
  const hy = ly / 2;
  const hz = lz / 2;

  const offset0: Vec3 = {
    x: clamp(bubble.offset.x, -hx, hx),
    y: clamp(bubble.offset.y, -hy, hy),
    z: clamp(bubble.offset.z, -hz, hz),
  };

  const rMax0 = Math.max(
    0,
    Math.min(hx - Math.abs(offset0.x), hy - Math.abs(offset0.y), hz - Math.abs(offset0.z))
  );
  const radius0 = clamp(bubble.radius, 0, rMax0);

  const offset1: Vec3 = {
    x: clamp(offset0.x, -(hx - radius0), hx - radius0),
    y: clamp(offset0.y, -(hy - radius0), hy - radius0),
    z: clamp(offset0.z, -(hz - radius0), hz - radius0),
  };

  return { ...bubble, radius: radius0, offset: offset1 };
}

export function applyBubblePhysics(
  baseWeights: number[],
  bubble?: BubbleConfig,
  kBase?: number,
  die: { lx: number; ly: number; lz: number } = { lx: 1, ly: 1, lz: 1 }
): number[] {
  if (!bubble?.enabled) return baseWeights;
  if (!Array.isArray(baseWeights) || baseWeights.length !== 6) return baseWeights;

  for (const w of baseWeights) {
    if (!Number.isFinite(w)) throw new Error("baseWeights must contain finite numbers.");
    if (w < 0) throw new Error("baseWeights must be >= 0.");
  }

  const lx = Math.max(die.lx, 0.01);
  const ly = Math.max(die.ly, 0.01);
  const lz = Math.max(die.lz, 0.01);

  const hx = lx / 2;
  const hy = ly / 2;
  const hz = lz / 2;

  const effectiveBubble = clampBubbleToDie(bubble, { lx, ly, lz });
  const r = effectiveBubble.radius;
  if (r <= 0) return baseWeights;

  const vDie = lx * ly * lz;
  const vBubble = (4 / 3) * Math.PI * r * r * r;
  const vSolid = Math.max(vDie - vBubble, 1e-12);

  const alpha = vBubble / vSolid;

  const comShift: Vec3 = {
    x: -alpha * effectiveBubble.offset.x,
    y: -alpha * effectiveBubble.offset.y,
    z: -alpha * effectiveBubble.offset.z,
  };

  const minHalf = Math.min(hx, hy, hz);
  const k = Number.isFinite(kBase) ? (kBase as number) : 8 / minHalf;

  const newWeights = baseWeights.map((w, i) => {
    const n = FACE_NORMS[i];
    const dh = dot(comShift, n);
    const mult = Math.exp(-k * dh);
    const out = w * mult;
    return out < 0 ? 0 : out;
  });

  const sum = newWeights.reduce((acc, w) => acc + w, 0);
  return sum > 0 ? newWeights : baseWeights;
}

export function normalizeWeights(weights: number[]): number[] {
  if (!Array.isArray(weights) || weights.length === 0) {
    throw new Error("Weights must be a non-empty array.");
  }

  for (const w of weights) {
    if (!Number.isFinite(w)) throw new Error("Weights must be finite numbers.");
    if (w < 0) throw new Error("Weights must be >= 0.");
  }

  const sum = weights.reduce((acc, w) => acc + w, 0);
  if (sum <= 0) return Array(weights.length).fill(1 / weights.length);
  return weights.map((w) => w / sum);
}

export function rollFromProbs(probs: number[]): number {
  if (!Array.isArray(probs) || probs.length === 0) {
    throw new Error("Probs must be a non-empty array.");
  }

  let s = 0;
  for (const p of probs) {
    if (!Number.isFinite(p)) throw new Error("Probabilities must be finite numbers.");
    if (p < 0) throw new Error("Probabilities must be >= 0.");
    s += p;
  }
  if (s <= 0) throw new Error("Sum of probabilities must be > 0.");

  if (Math.abs(s - 1) > 1e-9) {
    probs = probs.map((p) => p / s);
  }

  const u = Math.random();
  let cumulative = 0;
  for (let i = 0; i < probs.length; i++) {
    cumulative += probs[i];
    if (u <= cumulative) return i;
  }
  return probs.length - 1;
}

export function rollWeightedDie(weights: number[]): number {
  const probs = normalizeWeights(weights);
  return rollFromProbs(probs);
}

export function simulateRolls(weights: number[], n: number, sampleStep = 10) {
  if (!Number.isFinite(n) || n <= 0) throw new Error("n must be a positive integer.");
  n = Math.floor(n);

  if (!Number.isFinite(sampleStep) || sampleStep <= 0) throw new Error("sampleStep must be >= 1.");
  sampleStep = Math.floor(sampleStep);

  const k = weights.length;
  const counts = Array(k).fill(0) as number[];
  const runningMean: number[] = [];

  const probs = normalizeWeights(weights);

  const cdf = buildCDF(probs);

  let sumValues = 0;

  for (let i = 0; i < n; i++) {
    const u = Math.random();
    const idx = invBySeqSearch(cdf, u);

    counts[idx]++;
    sumValues += idx + 1;

    if ((i + 1) % sampleStep === 0 || i === n - 1) {
      runningMean.push(sumValues / (i + 1));
    }
  }

  const relFreq = counts.map((c) => c / n);
  return { counts, relFreq, probs, runningMean, sampleStep };
}

export function weightsFromDimensions(
  dimensions: { lx: number; ly: number; lz: number },
  exponent: number
): number[] {
  if (!Number.isFinite(exponent)) throw new Error("exponent must be a finite number.");

  const clean = {
    lx: Math.max(dimensions.lx, 0.01),
    ly: Math.max(dimensions.ly, 0.01),
    lz: Math.max(dimensions.lz, 0.01),
  };

  const areaXZ = clean.lx * clean.lz; // faces 1 & 6 (±Y)
  const areaYZ = clean.ly * clean.lz; // faces 2 & 5 (±X)
  const areaXY = clean.lx * clean.ly; // faces 3 & 4 (±Z)

  const scale = (a: number) => Math.pow(a, exponent);

  return [
    scale(areaXZ), // Face 1
    scale(areaYZ), // Face 2
    scale(areaXY), // Face 3
    scale(areaXY), // Face 4
    scale(areaYZ), // Face 5
    scale(areaXZ), // Face 6
  ];
}

export function dimensionsFromWeights(
  weights: number[],
  exponent: number
): { lx: number; ly: number; lz: number } {
  if (!Array.isArray(weights) || weights.length !== 6) {
    throw new Error("weights must be an array of length 6.");
  }
  if (!Number.isFinite(exponent) || exponent === 0) {
    throw new Error("exponent must be a finite nonzero number.");
  }

  for (const w of weights) {
    if (!Number.isFinite(w)) throw new Error("weights must contain finite numbers.");
    if (w <= 0) throw new Error("weights must be > 0 to invert into dimensions.");
  }

  const invScale = (w: number) => Math.pow(w, 1 / exponent);

  const w1 = weights[0];
  const w2 = weights[1];
  const w3 = weights[2];
  const w4 = weights[3];
  const w5 = weights[4];
  const w6 = weights[5];

  const areaXZ = Math.sqrt(invScale(w1) * invScale(w6)); // lx*lz
  const areaYZ = Math.sqrt(invScale(w2) * invScale(w5)); // ly*lz
  const areaXY = Math.sqrt(invScale(w3) * invScale(w4)); // lx*ly

  const lx = Math.sqrt((areaXY * areaXZ) / areaYZ);
  const ly = areaXY / lx;
  const lz = areaXZ / lx;

  return {
    lx: Math.max(lx, 0.01),
    ly: Math.max(ly, 0.01),
    lz: Math.max(lz, 0.01),
  };
}