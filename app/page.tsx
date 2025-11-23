"use client";

import { useMemo, useState } from "react";
import { simulateRolls, weightsFromDimensions } from "@/lib/die";
import { WeightedDieCanvas } from "@/components/die";
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

export default function HomePage() {
  const [mode, setMode] = useState<MODE>("weights");
  const [weights, setWeights] = useState<number[]>(INITIAL_WEIGHTS);
  const [fixedWeights, setFixedWeights] = useState<number[]>(INITIAL_WEIGHTS);
  const [dimensions, setDimensions] = useState<typeof INITIAL_DIMENSIONS>(INITIAL_DIMENSIONS);
  const [nRolls, setNRolls] = useState(1000);
  const [counts, setCounts] = useState<number[] | null>(null);
  const [relFreq, setRelFreq] = useState<number[] | null>(null);
  const [probs, setProbs] = useState<number[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const currentWeights = mode === "weights" ? weights : weightsFromDimensions(dimensions, 1);

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

  const handleSimulate = () => {
    try {
      setError(null);
      setIsSimulating(true);
      setFixedWeights(currentWeights);
      const { counts, relFreq, probs } = simulateRolls(currentWeights, nRolls);
      setCounts(counts);
      setRelFreq(relFreq);
      setProbs(probs);
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
                Weights are proportional to the landing face area (raised to an exponent to accentuate bias).
              </p>
            </div>
          )}
          <button
            onClick={handleSimulate}
            disabled={isSimulating}
            className="mt-2 px-4 py-2 rounded bg-white text-black text-sm font-bold uppercase cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSimulating ? "Simulating..." : "Simulate"}
          </button>

          {error && <div className="text-red-600 text-sm mt-2">Hiba: {error}</div>}

          <div className="text-sm sm:text-base">
            <div className="flex items-center justify-between">
              <span>Theoretical expected value (E[X])</span>
              {probs ? probs.reduce((sum, p, i) => sum + p * (i + 1), 0).toFixed(4) : "-"}
            </div>
            <div className="flex items-center justify-between">
              <span>Sample expected value (E[X])</span>
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
              <span>Sample variance (D&#x00B2;[X])</span>
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
          <WeightedDieCanvas weights={weights} />

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