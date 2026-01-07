/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, LabelList, Line, LineChart } from "recharts";
import { applyBubblePhysics, clampBubbleToDie, simulateRolls, weightsFromDimensions } from "@/lib/die";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WeightedDieCanvas } from "@/components/die_model";
import { BubbleConfig, DEFAULT_BUBBLE } from "@/types/bubble";
import {
  calculateChiSquare,
  calculateMeanCI,
  calculateStdDevCI,
  type ChiSquareResult as ChiSquareResultType,
  type ConfidenceInterval as ConfidenceIntervalType,
} from "@/lib/stats";

type MODE = "weights" | "dimensions";

const INITIAL_WEIGHTS = [1, 1, 1, 1, 1, 1];
const INITIAL_DIMENSIONS = { lx: 1, ly: 1, lz: 1 };
const DIMENSIONS_EXPONENT = 1;

type DieDims = { lx: number; ly: number; lz: number };

export default function HomePage() {
  // -----------------------------
  // Core state
  // -----------------------------
  const [mode, setMode] = useState<MODE>("weights");
  const [weights, setWeights] = useState<number[]>(INITIAL_WEIGHTS);
  const [fixedWeights, setFixedWeights] = useState<number[]>(INITIAL_WEIGHTS);
  const [dimensions, setDimensions] =
    useState<typeof INITIAL_DIMENSIONS>(INITIAL_DIMENSIONS);
  const [bubble, setBubble] = useState<BubbleConfig>(DEFAULT_BUBBLE);
  const [nRolls, setNRolls] = useState(1000);

  // -----------------------------
  // Simulation outputs
  // -----------------------------
  const [counts, setCounts] = useState<number[] | null>(null);
  const [relFreq, setRelFreq] = useState<number[] | null>(null);
  const [probs, setProbs] = useState<number[] | null>(null);
  const [runningMean, setRunningMean] = useState<number[] | null>(null);

  // -----------------------------
  // UI state
  // -----------------------------
  const [error, setError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // -----------------------------
  // Derived values
  // -----------------------------
  const dieDims: DieDims = mode === "dimensions" ? dimensions : INITIAL_DIMENSIONS;

  const halfDims = useMemo(
    () => ({ x: dieDims.lx / 2, y: dieDims.ly / 2, z: dieDims.lz / 2 }),
    [dieDims.lx, dieDims.ly, dieDims.lz]
  );

  const baseWeights =
    mode === "weights"
      ? weights
      : weightsFromDimensions(dimensions, DIMENSIONS_EXPONENT);

  useEffect(() => {
    setBubble((prev) =>
      clampBubbleToDie(prev, { lx: dieDims.lx, ly: dieDims.ly, lz: dieDims.lz })
    );
  }, [dieDims.lx, dieDims.ly, dieDims.lz]);

  const currentWeights = applyBubblePhysics(baseWeights, bubble, undefined, dieDims);

  // -----------------------------
  // Derived chart data
  // -----------------------------
  const probData = useMemo(() => {
    if (!probs || !relFreq) return [];
    return probs.map((p, i) => ({
      face: i + 1,
      theoretical: Number(p.toFixed(4)),
      sample: Number(relFreq[i].toFixed(4)),
    }));
  }, [probs, relFreq]);

  const cdfData = useMemo(() => {
    if (!probs || !relFreq) return [];
    let cumTheoretical = 0;
    let cumEmpirical = 0;

    return probs.map((p, i) => {
      cumTheoretical += p;
      cumEmpirical += relFreq[i];
      return {
        face: i + 1,
        theoreticalCdf: Number(cumTheoretical.toFixed(4)),
        empiricalCdf: Number(cumEmpirical.toFixed(4)),
      };
    });
  }, [probs, relFreq]);

  const cltData = useMemo(() => {
    const means: number[] = [];
    
    for (let i = 0; i < nRolls; i++) {
      const { counts } = simulateRolls(currentWeights, nRolls, nRolls);
      let s = 0; let total = 0;
      counts.forEach((c, idx) => {
        s += c * (idx + 1);
        total += c;
      });
      means.push(s / total);
    }
    
    return means;
  }, [currentWeights, nRolls]);

  const theoMean = useMemo(() => {
    if (!probs) return 0;
    return probs.reduce((sum, p, i) => sum + p * (i + 1), 0);
  }, [probs]);

  const meanData = useMemo(() => {
    if (!runningMean) return [];
    const sampleStep = Math.max(
      1,
      Math.floor(nRolls / Math.max(1, runningMean.length))
    );
    return runningMean.map((m, idx) => ({
      n: (idx + 1) * sampleStep,
      mean: Number(m.toFixed(4)),
    }));
  }, [runningMean, nRolls]);

  // -----------------------------
  // Chart configs
  // -----------------------------
  const probConfig = {
    theoretical: { label: "P(theoretical)", color: "hsl(220, 90%, 56%)" },
    sample: { label: "P(empirical)", color: "hsl(14, 88%, 62%)" },
  };

  const cdfChartConfig = {
    theoreticalCdf: { label: "F(theoretical)", color: "hsl(220, 90%, 56%)" },
    empiricalCdf: { label: "F(empirical)", color: "hsl(14, 88%, 62%)" },
  };

  const meanChartConfig = {
    mean: { label: "Empirical mean", color: "hsl(14, 88%, 62%)" },
    theo: { label: "E[X]", color: "hsl(220, 90%, 56%)" },
  };

  const cltChartConfig = {
    count: { label: "Frequency", color: "hsl(220, 90%, 56%)" },
  };

  // -----------------------------
  // Handlers
  // -----------------------------
  const handleWeightChange = (index: number, value: number) => {
    setWeights((prev) => {
      const newWeights = [...prev];
      newWeights[index] = Math.max(value, 0);
      return newWeights;
    });
  };

  const handleDimensionChange = (
    key: keyof typeof INITIAL_DIMENSIONS,
    value: number
  ) => {
    setDimensions((prev) => ({
      ...prev,
      [key]: Math.max(value, 0.01),
    }));
  };

  const handleBubbleSizeChange = (value: number) => {
    setBubble((prev) => clampBubbleToDie({ ...prev, radius: value }, dieDims));
  };

  const handleBubbleOffsetChange = (
    axis: keyof typeof bubble.offset,
    value: number
  ) => {
    setBubble((prev) =>
      clampBubbleToDie(
        { ...prev, offset: { ...prev.offset, [axis]: value } },
        dieDims
      )
    );
  };

  const handleSimulate = async () => {
    try {
      setError(null);
      setIsSimulating(true);

      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      );

      setFixedWeights(currentWeights);

      const { counts, relFreq, probs, runningMean } = simulateRolls(
        currentWeights,
        nRolls
      );

      setCounts(counts);
      setRelFreq(relFreq);
      setProbs(probs);
      setRunningMean(runningMean);
    } catch {
      setError("An unexpected error occurred during the simulation.");
    } finally {
      setIsSimulating(false);
    }
  };

  // -----------------------------
  // Summary values
  // -----------------------------
  const theoreticalEV = probs
    ? probs.reduce((sum, p, i) => sum + p * (i + 1), 0)
    : null;

  const empiricalEV = relFreq
    ? relFreq.reduce((sum, f, i) => sum + f * (i + 1), 0)
    : null;

  const theoreticalVar = probs
    ? probs.reduce((sum, p, i) => sum + p * Math.pow(i + 1, 2), 0) -
      Math.pow(probs.reduce((sum, p, i) => sum + p * (i + 1), 0), 2)
    : null;

  const empiricalVar = relFreq
    ? relFreq.reduce((sum, f, i) => sum + f * Math.pow(i + 1, 2), 0) -
      Math.pow(relFreq.reduce((sum, f, i) => sum + f * (i + 1), 0), 2)
    : null;

  const chiSquaredStats = useMemo(() => {
    if (!counts || !probs) return null;
    return calculateChiSquare(counts, probs, nRolls);
  }, [counts, probs, nRolls]);

  const statsCIs = useMemo(() => {
    if (empiricalEV === null || empiricalVar === null) return null;
    const stdDev = Math.sqrt(empiricalVar);
    return {
      mean: calculateMeanCI(empiricalEV, stdDev, nRolls),
      stdDev: calculateStdDevCI(stdDev, nRolls),
    };
  }, [empiricalEV, empiricalVar, nRolls]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-start p-8 gap-8">
      <h1 className="text-2xl font-bold mb-2">Weighted Die Simulator</h1>

      <ModeToggle mode={mode} setMode={setMode} />

      <div className="flex flex-col md:flex-row gap-8 w-full max-w-5xl">
        <div className="flex-1 flex flex-col gap-4">
          <NumberInput
            label="Number of Rolls:"
            value={nRolls}
            min={1}
            onChange={(v) => setNRolls(v)}
          />

          {mode === "weights" ? (
            <WeightsGrid weights={weights} onChange={handleWeightChange} />
          ) : (
            <DimensionsPanel
              dimensions={dimensions}
              onChange={handleDimensionChange}
              currentWeights={currentWeights}
              exponent={DIMENSIONS_EXPONENT}
            />
          )}

          <BubblePanel
            bubble={bubble}
            dieDims={dieDims}
            halfDims={halfDims}
            setBubble={setBubble}
            onRadiusChange={handleBubbleSizeChange}
            onOffsetChange={handleBubbleOffsetChange}
          />

          <PrimaryButton onClick={handleSimulate} disabled={isSimulating}>
            {isSimulating ? "Simulating..." : "Simulate"}
          </PrimaryButton>

          {error && <ErrorBanner message={error} />}

          <SummaryPanel
            theoreticalEV={theoreticalEV}
            empiricalEV={empiricalEV}
            theoreticalVar={theoreticalVar}
            empiricalVar={empiricalVar}
            chiStats={chiSquaredStats}
            cis={statsCIs}
          />
        </div>

        <div className="flex-1">
          <WeightedDieCanvas weights={currentWeights} bubble={bubble} dimensions={dieDims} />

          {counts && relFreq && probs && (
            <div className="mt-4">
              <ProbCard probData={probData} probConfig={probConfig} />
              <MeanConvCard meanConvData={meanData} theoMeanConv={theoMean} meanConvChartConfig={meanChartConfig} />
              <CdfCard cdfData={cdfData} cdfChartConfig={cdfChartConfig} />        
              <CltCard cltData={cltData} cltChartConfig={cltChartConfig} />

              <ResultsTable
                fixedWeights={fixedWeights}
                counts={counts}
                relFreq={relFreq}
                probs={probs}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

/* =========================
   Components
========================= */

function ModeToggle({
  mode,
  setMode,
}: {
  mode: MODE;
  setMode: React.Dispatch<React.SetStateAction<MODE>>;
}) {
  return (
    <div className="flex gap-8 mb-4">
      <button
        onClick={() => setMode("weights")}
        className={
          mode === "weights"
            ? "underline underline-offset-2"
            : "cursor-pointer text-slate-400 hover:text-slate-200 transition-all"
        }
      >
        Manual weights
      </button>

      <button
        onClick={() => setMode("dimensions")}
        className={
          mode === "dimensions"
            ? "underline underline-offset-2"
            : "cursor-pointer text-slate-400 hover:text-slate-200 transition-all"
        }
      >
        Physical dimensions
      </button>
    </div>
  );
}

function NumberInput({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="flex items-center gap-2">
        <span className="w-40 whitespace-nowrap">{label}</span>
        <input
          type="number"
          value={value}
          min={min}
          onChange={(e) => onChange(Number(e.target.value))}
          className="border px-2 py-1 rounded w-full"
        />
      </label>
    </div>
  );
}

function WeightsGrid({
  weights,
  onChange,
}: {
  weights: number[];
  onChange: (index: number, value: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {weights.map((w, i) => (
        <div key={i} className="border rounded-lg p-2 flex flex-col gap-2">
          <div className="text-center font-semibold uppercase">Face {i + 1}</div>
          <label className="text-xs uppercase">
            Weight:
            <input
              type="number"
              min={0}
              step={0.1}
              value={w}
              onChange={(e) => onChange(i, Number(e.target.value))}
              className="border px-2 py-1 rounded w-full mt-1"
            />
          </label>
        </div>
      ))}
    </div>
  );
}

function DimensionsPanel({
  dimensions,
  onChange,
  currentWeights,
  exponent,
}: {
  dimensions: { lx: number; ly: number; lz: number };
  onChange: (key: "lx" | "ly" | "lz", value: number) => void;
  currentWeights: number[];
  exponent: number;
}) {
  return (
    <div className="flex flex-col gap-3 border rounded-lg p-3">
      <div className="text-xs uppercase font-semibold">Physical dimensions</div>

      {(["lx", "ly", "lz"] as const).map((key) => (
        <label key={key} className="flex items-center gap-2 text-sm">
          <span className="w-12 uppercase">{key}</span>
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={dimensions[key]}
            onChange={(e) => onChange(key, Number(e.target.value))}
            className="border px-2 py-1 rounded w-full"
          />
        </label>
      ))}

      <div className="grid grid-cols-2 gap-2 text-xs">
        {currentWeights.map((w, i) => (
          <div key={i} className="flex justify-between border rounded px-2 py-1">
            <span>Face {i + 1}</span>
            <span>{w.toFixed(3)}</span>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-center text-slate-500">
        Weights are proportional to the landing face area (exponent {exponent}).
      </p>
    </div>
  );
}

function BubblePanel({
  bubble,
  dieDims,
  halfDims,
  setBubble,
  onRadiusChange,
  onOffsetChange,
}: {
  bubble: BubbleConfig;
  dieDims: { lx: number; ly: number; lz: number };
  halfDims: { x: number; y: number; z: number };
  setBubble: React.Dispatch<React.SetStateAction<BubbleConfig>>;
  onRadiusChange: (value: number) => void;
  onOffsetChange: (axis: "x" | "y" | "z", value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-4 border rounded-lg p-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold uppercase text-sm">Enable Air Bubble</span>
        <input
          type="checkbox"
          checked={bubble.enabled}
          onChange={(e) =>
            setBubble((prev) =>
              clampBubbleToDie({ ...prev, enabled: e.target.checked }, dieDims)
            )
          }
          className="size-5 accent-blue-400"
        />
      </div>

      {bubble.enabled && (
        <div className="flex flex-col gap-2">
          <div className="text-xs uppercase font-semibold text-slate-400">Radius</div>
          <input
            type="number"
            step={0.01}
            min={0}
            max={Math.min(halfDims.x, halfDims.y, halfDims.z)}
            value={bubble.radius}
            onChange={(e) => onRadiusChange(Number(e.target.value))}
            className="border px-2 py-1 rounded w-full"
          />

          <div className="text-xs uppercase font-semibold text-slate-400">
            Position Offset (Relative to Center)
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(["x", "y", "z"] as const).map((axis) => (
              <label key={axis} className="flex flex-col text-xs">
                <span className="uppercase mb-1">{axis}</span>
                <input
                  type="number"
                  step={0.01}
                  min={-halfDims[axis]}
                  max={halfDims[axis]}
                  value={bubble.offset[axis]}
                  onChange={(e) => onOffsetChange(axis, Number(e.target.value))}
                  className="border px-2 py-1 rounded"
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mt-2 px-4 py-2 rounded bg-white text-black text-sm font-bold uppercase cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return <div className="text-red-600 text-sm mt-2">ERROR: {message}</div>;
}


function SummaryPanel({
  theoreticalEV,
  empiricalEV,
  theoreticalVar,
  empiricalVar,
  chiStats,
  cis,
}: {
  theoreticalEV: number | null;
  empiricalEV: number | null;
  theoreticalVar: number | null;
  empiricalVar: number | null;
  chiStats: ChiSquareResultType | null;
  cis: { mean: ConfidenceIntervalType; stdDev: ConfidenceIntervalType } | null;
}) {
  return (
    <div className="text-sm sm:text-base flex flex-col gap-1">
      <SummaryRow label="Theoretical E[X]" value={theoreticalEV} />
      <SummaryRow 
        label="Empirical mean" 
        value={empiricalEV} 
        subValue={cis ? `(95% CI: [${cis.mean.min.toFixed(3)}, ${cis.mean.max.toFixed(3)}])` : undefined}
      />
      <SummaryRow label="Theoretical Var(X)" value={theoreticalVar} />
      <SummaryRow 
        label="Empirical Var(X)" 
        value={empiricalVar} 
        subValue={cis && empiricalVar ? `(SD: ${Math.sqrt(empiricalVar).toFixed(3)} ± ${((cis.stdDev.max - cis.stdDev.min)/2).toFixed(3)})` : undefined}
      />
      
      {chiStats && (
        <>
          <div className="h-px bg-slate-200 my-2" />
          <div className="flex items-center justify-between font-medium">
             <span>χ² Statistic</span>
             <span>{chiStats.statistic.toFixed(3)}</span>
          </div>
           <div className="flex items-center justify-between text-slate-600">
             <span>goodness-of-fit</span> {/*p-value*/}
             <span className={chiStats.pValue < 0.05 ? "text-red-600 font-bold" : "text-green-600 font-bold"}>
               {chiStats.pValue.toFixed(4)}
             </span>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryRow({ label, value, subValue }: { label: string; value: number | null, subValue?: string }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <span className="font-medium">{value === null ? "-" : value.toFixed(4)}</span>
      </div>
      {subValue && <div className="text-xs text-right text-slate-400">{subValue}</div>}
    </div>
  );
}

function ProbCard({
  probData,
  probConfig,
}: {
  probData: { face: number; theoretical: number; sample: number }[];
  probConfig: any;
}) {
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Theoretical vs. Empirical Probabilities</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={probConfig} className="h-72 w-full mb-4">
          <BarChart data={probData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="face" tickFormatter={(v) => `Face ${v}`} />
            <YAxis
              tickFormatter={(v) => v.toFixed(2)}
              domain={[0, (dataMax: number) => dataMax * 1.25]}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />

            <Bar
              dataKey="theoretical"
              fill="var(--color-theoretical)"
              radius={[4, 4, 0, 0]}
            >
              <LabelList
                dataKey="theoretical"
                formatter={(v: number) => v.toFixed(3)}
                position="top"
              />
            </Bar>

            <Bar dataKey="sample" fill="var(--color-sample)" radius={[4, 4, 0, 0]}>
              <LabelList
                dataKey="sample"
                formatter={(v: number) => v.toFixed(3)}
                position="top"
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function MeanConvCard({
  meanConvData: meanData,
  meanConvChartConfig: meanChartConfig,
  theoMeanConv: theoMean,
}: {
  meanConvData: { n: number; mean: number }[];
  meanConvChartConfig: any;
  theoMeanConv: number;
}) {
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Convergence of the Empirical Mean (LLN)</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={meanChartConfig} className="h-72 w-full mb-4">
          <LineChart data={meanData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="n" tickFormatter={(v) => `${v}`} />
            <YAxis tickFormatter={(v) => v.toFixed(2)} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />

            <Line
              type="monotone"
              dataKey={() => theoMean}
              stroke="var(--color-theo)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />

            <Line
              type="monotone"
              dataKey="mean"
              stroke="var(--color-mean)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function CdfCard({
  cdfData,
  cdfChartConfig,
}: {
  cdfData: { face: number; theoreticalCdf: number; empiricalCdf: number }[];
  cdfChartConfig: any;
}) {
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Theoretical vs. Empirical CDF</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={cdfChartConfig} className="h-72 w-full mb-4">
          <LineChart data={cdfData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="face" tickFormatter={(v) => `Face ${v}`} />
            <YAxis domain={[0, 1]} tickFormatter={(v) => v.toFixed(2)} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />

            <Line
              type="stepAfter"
              dataKey="theoreticalCdf"
              stroke="var(--color-theoreticalCdf)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />

            <Line
              type="stepAfter"
              dataKey="empiricalCdf"
              stroke="var(--color-empiricalCdf)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function ResultsTable({
  fixedWeights,
  counts,
  relFreq,
  probs,
}: {
  fixedWeights: number[];
  counts: number[];
  relFreq: number[];
  probs: number[];
}) {
  return (
    <table className="border-collapse border rounded-xl w-full text-xs sm:text-sm mt-4">
      <thead>
        <tr>
          <th className="border sm:px-2 py-1">Face</th>
          <th className="border sm:px-2 py-1">Weight</th>
          <th className="border sm:px-2 py-1">P(theo.)</th>
          <th className="border sm:px-2 py-1">Freq.</th>
          <th className="border sm:px-2 py-1">P(emp.)</th>
          <th className="border sm:px-2 py-1">abs error</th>
          <th className="border sm:px-2 py-1">rel error</th>
        </tr>
      </thead>

      <tbody>
        {fixedWeights.map((w, i) => (
          <tr key={i}>
            <td className="border px-2 py-1 text-center">{i + 1}</td>
            <td className="border px-2 py-1 text-center">{w}</td>
            <td className="border px-2 py-1 text-center">{probs[i].toFixed(4)}</td>
            <td className="border px-2 py-1 text-center">{counts[i]}</td>
            <td className="border px-2 py-1 text-center">{relFreq[i].toFixed(4)}</td>
            <td className="border px-2 py-1 text-center">
              {Math.abs(relFreq[i] - probs[i]).toFixed(4)}
            </td>
            <td className="border px-2 py-1 text-center">
              {probs[i] > 0
                ? (Math.abs(relFreq[i] - probs[i]) / probs[i]).toFixed(4)
                : "N/A"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CltCard({
  cltData: data,
  cltChartConfig: config,
}: {
  cltData: number[];
  cltChartConfig: any;
}) {
  const bins = useMemo(() => {
    if(!data.length) return [];
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min;
    const binCount = 20;
    const step = range / binCount || 0.1;
    
    const hist = Array.from({ length: binCount + 1 }, (_, i) => ({
      rangeStart: min + i * step,
      rangeEnd: min + (i + 1) * step,
      mid: min + i * step + step / 2,
      count: 0
    }));

    data.forEach(val => {
      const idx = Math.min(Math.floor((val - min) / step), binCount);
      if(hist[idx]) hist[idx].count++;
    });

    return hist;
  }, [data]);

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>CLT: Distribution of Sample Means</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-64 w-full mb-4">
          <BarChart data={bins} barCategoryGap={1}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="mid" 
              tickFormatter={(v) => v.toFixed(2)}
              // label={{ value: 'Sample Mean', position: 'insideBottom', offset: -5 }} 
            />
            <YAxis allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
             <Bar
              dataKey="count"
              fill="var(--color-count)"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}