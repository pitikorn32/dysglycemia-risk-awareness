# Dysglycemia risk awareness

This repository accompanies the IEEE EMBS BHI paper *Design and Verification of an Interactive Dysglycemia Risk-Awareness Service with Bounded What-If Simulation* by Pitikorn Khlaisamniang, Bhumpat Chaiwattanayon, Roongruedee Chaiteerakij and Patthrarawalai Sirinara.

It releases the browser scenario layer (Box 2 in the paper’s architecture). Move a slider to compare the fixed 1–5 year baseline with a scenario, or apply one of five ranked alternatives to see its trajectory and its rank across 16 multiplier endpoint combinations. The ranges express sensitivity to literature assumptions. They do not quantify personal treatment benefit.

## Run the synthetic example

From the repository root, use Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. The example starts with hand-authored baseline probabilities of 4%, 7%, 10%, 14% and 18%. These values come from the synthetic planner test case. Applying alternative 1 changes the displayed five-year scenario to 11.8%. Reset restores 18%.

The demo runs entirely in the browser. It loads no fitted models, accepts no patient records and requires no API keys. The assessment, baseline scoring service and model-attribution view from the full platform are outside this release. Reproducing cohort metrics and the scored trajectory in the paper’s interface figure requires separate inputs.

## Implementation

| File | Role |
| --- | --- |
| [src/App.tsx](src/App.tsx) | Supplies the synthetic baseline and starting BMI and weekly behavior values. |
| [src/scenario/scenarioEngine.ts](src/scenario/scenarioEngine.ts) | Applies the rounded literature multipliers to signed changes, floors the product at 0.30, and computes each scenario probability as `1 - (1 - baseline) ** multiplier`. |
| [src/scenario/planner.ts](src/scenario/planner.ts) | Enumerates bounded candidates, removes duplicates and ranks by mean scenario-to-baseline ratio plus 0.03 times effort. Repeats ranking at all 16 endpoint combinations. |
| [src/scenario/ScenarioExplorer.tsx](src/scenario/ScenarioExplorer.tsx) | Connects the manual controls and ranked alternatives to the trajectory chart and probability table. |

The companion modeling repository documents the longitudinal feature pipeline, target construction and model-development methods. [Dual-Track Longitudinal Diabetes Risk](https://github.com/pitikorn32/dual-track-longitudinal-diabetes-risk)

## Verification

```sh
npm test
npm run build
```

The tests cover the paper’s worked BMI example, probability bounds, the no-change case, candidate clipping, deterministic ordering and rank sensitivity. The production build writes static files to `dist/`. To independently regenerate and compare the synthetic reference values, run these commands with Python 3.10 or later.

```sh
python3 scripts/generate_scenario_goldens.py | diff - src/scenario/golden_cases.json
python3 scripts/generate_planner_goldens.py | diff - src/scenario/planner_golden.json
```
