"use client";

import { useEffect, useMemo, useState } from "react";
import { applyBubblePhysics, clampBubbleToDie, simulateRolls, weightsFromDimensions } from "@/lib/die";
import { WeightedDieCanvas } from "@/components/die_model";
import { BubbleConfig, DEFAULT_BUBBLE } from "@/types/bubble";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, LabelList, Line, LineChart } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MODE = "weights" | "dimensions";

const INITIAL_WEIGHTS = [1, 1, 1, 1, 1, 1];
const INITIAL_DIMENSIONS = { lx: 1, ly: 1, lz: 1 };
const DIMENSIONS_EXPONENT = 1;

export default function HomePage() {
  const [mode, setMode] = useState<MODE>("weights");
  const [weights, setWeights] = useState<number[]>(INITIAL_WEIGHTS);
  const [fixedWeights, setFixedWeights] = useState<number[]>(INITIAL_WEIGHTS);
  const [dimensions, setDimensions] = useState<typeof INITIAL_DIMENSIONS>(INITIAL_DIMENSIONS);
  const [bubble, setBubble] = useState<BubbleConfig>(DEFAULT_BUBBLE);
  const [nRolls, setNRolls] = useState(1000);
  const [counts, setCounts] = useState<number[] | null>(null);
  const [relFreq, setRelFreq] = useState<number[] | null>(null);
  const [probs, setProbs] = useState<number[] | null>(null);
  const [runningMean, setRunningMean] = useState<number[] | null>(null); // NEW
  const [error, setError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const dieDims = mode === "dimensions" ? dimensions : INITIAL_DIMENSIONS;
  const halfDims = useMemo(
    () => ({ x: dieDims.lx / 2, y: dieDims.ly / 2, z: dieDims.lz / 2 }),
    [dieDims.lx, dieDims.ly, dieDims.lz]
  );

  const baseWeights = mode === "weights" ? weights : weightsFromDimensions(dimensions, DIMENSIONS_EXPONENT);

  useEffect(() => {
    setBubble((b) =>
      clampBubbleToDie(b, { lx: dieDims.lx, ly: dieDims.ly, lz: dieDims.lz })
    );
  }, [dieDims.lx, dieDims.ly, dieDims.lz]);

  const currentWeights = applyBubblePhysics(baseWeights, bubble, undefined, dieDims);

  const probData = useMemo(
    () =>
      probs && relFreq
        ? probs.map((p, i) => ({
            face: i + 1,
            theoretical: Number(p.toFixed(4)),
            sample: Number(relFreq[i].toFixed(4)),
          }))
        : [],
    [probs, relFreq]
  );

  const probConfig = {
    theoretical: { label: "P(theoretical)", color: "hsl(220, 90%, 56%)" },
    sample: { label: "P(empirical)", color: "hsl(14, 88%, 62%)" },
  };

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

  const cdfChartConfig = {
    theoreticalCdf: { label: "F(theoretical)", color: "hsl(220, 90%, 56%)" },
    empiricalCdf: { label: "F(empirical)", color: "hsl(14, 88%, 62%)" },
  };

  // NEW: running mean chart data (LLN convergence)
  const meanData = useMemo(() => {
    if (!runningMean) return [];
    // Prefer something not too dense; you can tune this later without changing simulateRolls().
    const sampleStep = Math.max(1, Math.floor(nRolls / Math.max(1, runningMean.length)));
    return runningMean.map((m, idx) => ({
      n: (idx + 1) * sampleStep,
      mean: Number(m.toFixed(4)),
    }));
  }, [runningMean, nRolls]);

  const meanChartConfig = {
    mean: { label: "Empirical mean", color: "hsl(14, 88%, 62%)" },
    theo: { label: "E[X]", color: "hsl(220, 90%, 56%)" },
  };

  const theoMean = useMemo(() => {
    if (!probs) return null;
    return probs.reduce((sum, p, i) => sum + p * (i + 1), 0);
  }, [probs]);

  const handleWeightChange = (index: number, value: number) => {
    setWeights(prev => {
      const newWeights = [...prev];
      newWeights[index] = Math.max(value, 0);
      return newWeights;
    });
  };

  const handleDimensionChange = (key: keyof typeof INITIAL_DIMENSIONS, value: number) => {
    setDimensions(prev => ({
      ...prev,
      [key]: Math.max(value, 0.01),
    }));
  };

  const handleBubbleSizeChange = (value: number) => {
    setBubble((p) => clampBubbleToDie({ ...p, radius: value }, dieDims));
  };

  const handleBubbleOffsetChange = (axis: keyof typeof bubble.offset, value: number) => {
    setBubble((p) =>
      clampBubbleToDie(
        {
          ...p,
          offset: {
            ...p.offset,
            [axis]: value,
          },
        },
        dieDims
      )
    );
  };

  const handleSimulate = async () => {
    try {
      setError(null);
      setIsSimulating(true);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      setFixedWeights(currentWeights);
      const { counts, relFreq, probs, runningMean } = simulateRolls(currentWeights, nRolls); // UPDATED
      setCounts(counts);
      setRelFreq(relFreq);
      setProbs(probs);
      setRunningMean(runningMean); // NEW
    } catch {
      setError("An unexpected error occurred during the simulation.");
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-start p-8 gap-8">
      <h1 className="text-2xl font-bold mb-2">Weighted Die Simulator</h1>
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

      <div className="flex flex-col md:flex-row gap-8 w-full max-w-5xl">
        <div className="flex-1 flex flex-col gap-4">
          <div>
            <label className="flex items-center gap-2">
              <span className="w-40 whitespace-nowrap">Number of Rolls:</span>
              <input
                type="number"
                value={nRolls}
                min={1}
                onChange={e => setNRolls(Number(e.target.value))}
                className="border px-2 py-1 rounded w-full"
              />
            </label>
          </div>

          {mode === "weights" && (
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
                      onChange={e => handleWeightChange(i, Number(e.target.value))}
                      className="border px-2 py-1 rounded w-full mt-1"
                    />
                  </label>
                </div>
              ))}
            </div>
          )}

          {mode === "dimensions" && (
            <div className="flex flex-col gap-3 border rounded-lg p-3">
              <div className="text-xs uppercase font-semibold">Physical dimensions</div>
              {(["lx", "ly", "lz"] as const).map(key => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <span className="w-12 uppercase">{key}</span>
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={dimensions[key]}
                    onChange={e => handleDimensionChange(key, Number(e.target.value))}
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
                Weights are proportional to the landing face area (exponent {DIMENSIONS_EXPONENT}).
              </p>
            </div>
          )}

          <div className="flex flex-col gap-4 border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold uppercase text-sm">Enable Air Bubble</span>
              <input
                type="checkbox"
                checked={bubble.enabled}
                onChange={e => setBubble(p => clampBubbleToDie({ ...p, enabled: e.target.checked }, dieDims))}
                className="size-5 accent-blue-400"
              />
            </div>

            {bubble.enabled && (
              <>
                <div className="flex flex-col gap-2">
                  <div className="text-xs uppercase font-semibold text-slate-400">Radius</div>
                  <input
                    type="number"
                    step={0.01}
                    min={0}
                    max={Math.min(halfDims.x, halfDims.y, halfDims.z)}
                    value={bubble.radius}
                    onChange={e => handleBubbleSizeChange(Number(e.target.value))}
                    className="border px-2 py-1 rounded w-full"
                  />
                  <div className="text-xs uppercase font-semibold text-slate-400">Position Offset (Relative to Center)</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(["x", "y", "z"] as const).map(axis => (
                      <label key={axis} className="flex flex-col text-xs">
                        <span className="uppercase mb-1">{axis}</span>
                        <input
                          type="number"
                          step={0.01}
                          min={-halfDims[axis]}
                          max={halfDims[axis]}
                          value={bubble.offset[axis]}
                          onChange={e => handleBubbleOffsetChange(axis, Number(e.target.value))}
                          className="border px-2 py-1 rounded"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            onClick={handleSimulate}
            disabled={isSimulating}
            className="mt-2 px-4 py-2 rounded bg-white text-black text-sm font-bold uppercase cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSimulating ? "Simulating..." : "Simulate"}
          </button>

          {error && <div className="text-red-600 text-sm mt-2">ERROR: {error}</div>}

          <div className="text-sm sm:text-base">
            <div className="flex items-center justify-between">
              <span>Theoretical expected value (E[X])</span>
              {probs ? probs.reduce((sum, p, i) => sum + p * (i + 1), 0).toFixed(4) : "-"}
            </div>
            <div className="flex items-center justify-between">
              <span>Empirical expected value (E[X])</span>
              {relFreq ? relFreq.reduce((sum, f, i) => sum + f * (i + 1), 0).toFixed(4) : "-"}
            </div>
            <div className="flex items-center justify-between">
              <span>Theoretical variance (D&#x00B2;[X])</span>
              {probs
                ? (
                    probs.reduce((sum, p, i) => sum + p * Math.pow(i + 1, 2), 0) -
                    Math.pow(
                      probs.reduce((sum, p, i) => sum + p * (i + 1), 0),
                      2
                    )
                  ).toFixed(4)
                : "-"}
            </div>
            <div className="flex items-center justify-between">
              <span>Empirical variance (D&#x00B2;[X])</span>
              {relFreq
                ? (
                    relFreq.reduce((sum, f, i) => sum + f * Math.pow(i + 1, 2), 0) -
                    Math.pow(
                      relFreq.reduce((sum, f, i) => sum + f * (i + 1), 0),
                      2
                    )
                  ).toFixed(4)
                : "-"}
            </div>
          </div>
        </div>

        <div className="flex-1">
          <WeightedDieCanvas weights={currentWeights} bubble={bubble} dimensions={dieDims} />

          {counts && relFreq && probs && (
            <div className="mt-4">
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle>Theoretical vs. Empirical Probabilities</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={probConfig} className="h-72 w-full mb-4">
                    <BarChart data={probData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="face" tickFormatter={v => `Face ${v}`} />
                      <YAxis tickFormatter={v => v.toFixed(2)} domain={[0, (dataMax: number) => dataMax * 1.25]} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="theoretical" fill="var(--color-theoretical)" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="theoretical" formatter={(v: number) => v.toFixed(3)} position="top" />
                      </Bar>
                      <Bar dataKey="sample" fill="var(--color-sample)" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="sample" formatter={(v: number) => v.toFixed(3)} position="top" />
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              {runningMean && theoMean !== null && (
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
              )}

              <Card className="mb-4">
                <CardHeader>
                  <CardTitle>Theoretical vs. Empirical CDF</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={cdfChartConfig} className="h-72 w-full mb-4">
                    <LineChart data={cdfData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="face" tickFormatter={v => `Face ${v}`} />
                      <YAxis domain={[0, 1]} tickFormatter={v => v.toFixed(2)} />
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

              <table className="border-collapse border rounded-xl w-full text-xs sm:text-sm">
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
                        {probs[i] > 0 ? (Math.abs(relFreq[i] - probs[i]) / probs[i]).toFixed(4) : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}