# Dysglycemia risk awareness

This is the public platform source for *Design and Verification of an Interactive Dysglycemia Risk-Awareness Service with Bounded What-If Simulation* (IEEE EMBS BHI). Author and citation details are in [CITATION.cff](CITATION.cff).

The React client and FastAPI service implement the five-step assessment, input validation, eligibility checks, five baseline horizons, grouped log-odds explanations, manual what-if simulation, constrained ranking and sensitivity across 16 literature endpoint combinations. The gateway serves the browser and API from one origin.

**The default demo uses synthetic results.** Use invented inputs. All eligible profiles receive the same five illustrative baseline probabilities and hand-authored contributions. Entered measurements determine eligibility, and the lifestyle and BMI inputs determine the available scenario controls. Fitted models, private cohorts, internal evaluation outputs and credentials are excluded.

## Run with Docker Compose

From the repository root:

```sh
docker compose up --build
```

Open [the local platform](http://localhost:8080). Start the anonymous assessment, or choose the direct scenario example. The default deployment requires no model files or configuration. Stop it with `docker compose down`.

## Run locally

Use Python 3.12 and Node.js 24. From the repository root, start the API in one terminal:

```sh
python3.12 -m venv .venv
. .venv/bin/activate
python -m pip install -r backend/requirements-dev.txt
python -m uvicorn app.main:app --app-dir backend --port 8000
```

Start the browser client in a second terminal:

```sh
cd frontend
npm ci
npm run dev
```

Open the URL printed by Vite. The client proxies API requests to port 8000. The [interactive API documentation](http://localhost:8000/api/docs) lists the request fields and response types.

## Walk through an example

1. Start at the home page. Acknowledge the scope and enter age 42.
2. Enter 5 sugary drinks, 5 fruit or vegetable occasions and 2 exercise sessions per week.
3. Answer **No** to earlier fasting blood sugar (FBS) above 100 mg/dL. In the current annual slot, enter FBS 95 mg/dL and BMI 27. Leave the other slots blank.
4. Review and submit. The demo baseline runs from 4% at year one to 18% at year five. Select a year in the attribution view to inspect the example log-odds terms.
5. Apply alternative 1. The five-year scenario displays 11.8% while the baseline stays at 18%. Reset to return to the baseline. These values illustrate the software's assumptions and do not estimate individual treatment benefit.

To exercise the applicability gate, edit the assessment and change current FBS to 101 mg/dL. The result explains the eligibility decision and withholds probabilities. The standalone example at `/scenario-demo` also works with just the browser client.

## Source and scoring modes

| Source | Responsibility |
| --- | --- |
| [backend/app](backend/app) | Request and response schemas, applicability and missing-value handling, longitudinal features, integrity-checked model loading, scoring and grouped attribution. |
| [backend/app/demo.py](backend/app/demo.py) | Fixed synthetic probabilities and example contributions. |
| [frontend/src/assessment](frontend/src/assessment) | Typed five-step form, five annual slots, review, submission and edit flow. |
| [frontend/src/results](frontend/src/results) | Trajectory, horizon selection, applicability messages and attribution. |
| [frontend/src/scenario](frontend/src/scenario) | Survival-scale updates, bounds, deterministic candidate ranking and sensitivity. |
| [gateway](gateway) | Same-origin Nginx routing and API request limits. |

With `MODEL_MANIFEST` unset, the API uses the synthetic example. To run the original scoring path with a separately held compatible release, set `MODEL_MANIFEST` to its manifest path before starting the API. An explicitly configured release that fails to load returns HTTP 503. Check `GET /api/v1/health` for the active release ID. The API marks responses `no-store`; scenario edits stay in the browser.

The companion repository describes the modeling pipeline, feature construction and development methods. Reproducing the paper's cohort metrics requires the study data and fitted release. [Dual-Track Longitudinal Diabetes Risk](https://github.com/pitikorn32/dual-track-longitudinal-diabetes-risk)

## Verification

With the Python environment active, the frontend dependencies installed and `MODEL_MANIFEST` unset, run from the repository root:

```sh
python -m pytest -q
cd frontend
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run capture:figures
```

Playwright starts its own demo API and frontend on ports 18401 and 4173. Its live test submits a synthetic assessment, inspects attribution, applies a scenario and edits the inputs. The optional capture command saves synthetic screenshots under `frontend/test-results/publication-figures/`. They illustrate the public fixture and use different values from the scored example in the paper.

To check the independent reference calculations from the frontend directory:

```sh
python scripts/generate_scenario_goldens.py | diff - src/scenario/golden_cases.json
python scripts/generate_planner_goldens.py | diff - src/scenario/planner_golden.json
```

## Research presentation site

The English-language [paper page source](website/) presents the BHI study design, results, synthetic Figure 2 walkthrough and downloadable BibTeX. It runs independently of the assessment service. To preview and check it with Node.js 24 and Python 3:

```sh
cd website
npm ci
npx playwright install chromium
npm test
npm run preview
```

Open [the local paper page](http://127.0.0.1:4173). The [Pages workflow](.github/workflows/paper-page.yml) checks relevant pull requests and changes to main. While the repository is private, it only runs the checks. When ready for public release, select **GitHub Actions** as the repository’s Pages source and run **Paper page** manually on main after making the repository public. It deploys only `website/dist`.
