import {
  Area,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { HorizonProbability } from "../api/baseline";
import type { ScenarioResult } from "../scenario/scenarioEngine";

interface ChartPoint {
  baseline: number;
  horizon_years: number;
  label: string;
  scenario: number;
  scenarioLow: number;
  scenarioRange: number;
}

function percent(value: number) {
  return new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

function percentageDifference(baseline: number, scenario: number) {
  const difference = (scenario - baseline) * 100;
  if (Math.abs(difference) < 0.05) return "approximately 0.0 percentage points";
  return `${difference > 0 ? "+" : ""}${difference.toFixed(1)} percentage points`;
}

function chartPoints(
  baseline: HorizonProbability[],
  scenario: ScenarioResult,
): ChartPoint[] {
  const scenarios = new Map(scenario.horizons.map((item) => [item.horizon_years, item]));
  return baseline.flatMap((item) => {
    const scenarioItem = scenarios.get(item.horizon_years);
    if (!scenarioItem) return [];
    return [
      {
        baseline: item.probability,
        horizon_years: item.horizon_years,
        label: `${item.horizon_years}-year`,
        scenario: scenarioItem.point,
        scenarioLow: scenarioItem.low,
        scenarioRange: Math.max(0, scenarioItem.high - scenarioItem.low),
      },
    ];
  });
}

function TrajectoryTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartPoint }>;
}) {
  if (!active || !payload?.[0]?.payload) return null;
  const point = payload[0].payload;
  return (
    <div className="trajectory-tooltip">
      <strong>{point.label} horizon</strong>
      <dl>
        <div><dt>Baseline risk</dt><dd>{percent(point.baseline)}</dd></div>
        <div><dt>Scenario estimate</dt><dd>{percent(point.scenario)}</dd></div>
        <div><dt>Assumption range</dt><dd>{percent(point.scenarioLow)}–{percent(point.scenarioLow + point.scenarioRange)}</dd></div>
        <div><dt>Scenario difference</dt><dd>{percentageDifference(point.baseline, point.scenario)}</dd></div>
      </dl>
    </div>
  );
}

export function TrajectoryChart({
  baseline,
  onSelectHorizon,
  scenario,
  selectedHorizon,
}: {
  baseline: HorizonProbability[];
  onSelectHorizon: (horizon: number) => void;
  scenario: ScenarioResult;
  selectedHorizon: number;
}) {
  const data = chartPoints(baseline, scenario);
  const selected = data.find((item) => item.horizon_years === selectedHorizon) ?? data.at(-1);

  return (
    <div className="trajectory-presentation">
      <div className="trajectory-heading">
        <p className="eyebrow">Five-horizon comparison</p>
        <h2 id="trajectory-heading">Baseline and scenario trajectory</h2>
        <p>
          The baseline stays fixed while the selected scenario updates under the published
          assumptions.
        </p>
      </div>
      {selected && (
        <div className="selected-horizon-summary" aria-live="polite">
          <span>{selected.label} horizon</span>
          <strong>{percent(selected.scenario)} scenario estimate</strong>
          <small>Baseline {percent(selected.baseline)} · {percentageDifference(selected.baseline, selected.scenario)}</small>
        </div>
      )}
      <div
        aria-label="Baseline risk trajectory chart"
        className="trajectory-chart-frame"
        role="img"
      >
        <ResponsiveContainer height="100%" minHeight={300} width="100%">
          <LineChart
            data={data}
            margin={{ bottom: 8, left: 4, right: 18, top: 12 }}
            onClick={(state) => {
              const chartState = state as unknown as {
                activePayload?: Array<{ payload?: ChartPoint }>;
              };
              const point = chartState?.activePayload?.[0]?.payload;
              if (point) onSelectHorizon(point.horizon_years);
            }}
          >
            <CartesianGrid className="chart-gridline" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fill: "var(--ink-soft)", fontSize: 12 }} />
            <YAxis
              domain={[0, 1]}
              tick={{ fill: "var(--ink-soft)", fontSize: 12 }}
              tickFormatter={(value: number) => `${value * 100}%`}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
            />
            <Tooltip content={<TrajectoryTooltip />} />
            <Area
              dataKey="scenarioLow"
              fill="transparent"
              isAnimationActive={false}
              stackId="assumption-range"
              stroke="none"
              type="monotone"
            />
            <Area
              dataKey="scenarioRange"
              fill="var(--green)"
              fillOpacity={0.16}
              isAnimationActive={false}
              stackId="assumption-range"
              stroke="none"
              type="monotone"
            />
            <Line
              activeDot={{ onClick: (_event, payload) => {
                const point = (payload as { payload?: ChartPoint })?.payload;
                if (point) onSelectHorizon(point.horizon_years);
              }, r: 7 }}
              dataKey="baseline"
              dot={{ r: 4 }}
              isAnimationActive={false}
              name="Baseline risk"
              stroke="var(--ink)"
              strokeDasharray="6 4"
              strokeWidth={3}
              type="monotone"
            />
            <Line
              activeDot={{ onClick: (_event, payload) => {
                const point = (payload as { payload?: ChartPoint })?.payload;
                if (point) onSelectHorizon(point.horizon_years);
              }, r: 8 }}
              dataKey="scenario"
              dot={{ r: 5 }}
              isAnimationActive={false}
              name="Scenario estimate"
              stroke="var(--green)"
              strokeWidth={4}
              type="monotone"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="trajectory-legend" aria-label="Chart legend">
        <span><i className="legend-swatch baseline" />Baseline risk</span>
        <span><i className="legend-swatch scenario" />Scenario estimate</span>
        <span><i className="legend-swatch range" />Assumption range</span>
      </div>
      <p className="trajectory-disclosure">
        The shaded range varies cited multiplier endpoints only. It is not a confidence or
        treatment interval and excludes baseline-model uncertainty, transportability, adherence,
        interactions, and measurement error.
      </p>
      <div className="table-scroll">
        <table aria-label="Exact baseline probabilities">
          <caption>Exact baseline probabilities</caption>
          <thead>
            <tr><th scope="col">Horizon</th><th scope="col">Estimated probability</th></tr>
          </thead>
          <tbody>
            {baseline.map((item) => (
              <tr key={item.horizon_years}>
                <th scope="row">
                  <button
                    className={`horizon-select${item.horizon_years === selectedHorizon ? " selected" : ""}`}
                    onClick={() => onSelectHorizon(item.horizon_years)}
                    type="button"
                  >
                    {item.horizon_years} year
                  </button>
                </th>
                <td>{percent(item.probability)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
