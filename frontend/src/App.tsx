import { useState } from "react";

import { AssessmentFlow } from "./assessment/AssessmentFlow";
import { ScenarioDemo } from "./ScenarioDemo";
import "./styles.css";

function Mark() {
  return (
    <svg aria-hidden="true" className="brand-mark" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="18" fill="currentColor" opacity="0.12" />
      <path
        d="M11 23c4.5-1.2 7-5.2 9-11 1.8 7.1 4.7 11.4 9 13"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.4"
      />
      <circle cx="29" cy="25" r="2.6" fill="currentColor" />
    </svg>
  );
}
function SiteHeader() {
  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label="Dysglycemia Risk Awareness home">
        <Mark />
        <span>
          <strong>Dysglycemia</strong>
          <small>Risk Awareness</small>
        </span>
      </a>
      <nav aria-label="Primary navigation">
        <a href="/about">Methods &amp; limits</a>
        <span className="prototype-badge">Research prototype</span>
      </nav>
    </header>
  );
}

function ScopeCard() {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <section className="scope-card" aria-labelledby="before-starting">
      <div>
        <p className="section-number">Before starting</p>
        <h2 id="before-starting">A careful estimate, not a clinical conclusion</h2>
      </div>
      <div className="scope-details">
        <ul>
          <li>Designed for adults exploring incident dysglycemia awareness.</li>
          <li>Inputs are sent to the baseline server for temporary processing; no profile is saved.</li>
          <li>Discuss health questions and results with a qualified clinician.</li>
        </ul>
        <label className="acknowledgement">
          <input
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            type="checkbox"
          />
          <span>
            I understand this is not a diagnosis or treatment recommendation.
          </span>
        </label>
        <button
          className="primary-action"
          disabled={!acknowledged}
          onClick={() => window.location.assign("/assessment")}
          type="button"
        >
          Start anonymous assessment <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}

function HomePage() {
  return (
    <>
      <main id="main-content">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">An interactive research prototype</p>
            <h1>Understand risk without pretending certainty.</h1>
            <p className="hero-intro">
              Explore a fixed 1–5 year dysglycemia risk estimate, then examine
              bounded what-if scenarios under clearly stated population evidence.
            </p>
          </div>
          <aside className="boundary-card" aria-label="How the prototype separates estimates">
            <div>
              <span>01</span>
              <strong>Baseline</strong>
              <p>In the public demo, every eligible profile receives the same five illustrative probabilities.</p>
            </div>
            <div className="boundary-line" aria-hidden="true" />
            <div>
              <span>02</span>
              <strong>Scenarios</strong>
              <p>Non-causal exploration using published associations.</p>
            </div>
          </aside>
        </section>
        <ScopeCard />
        <p><a className="text-link" href="/scenario-demo">Explore the synthetic scenario example directly →</a></p>
      </main>
      <footer>
        <p>No account · No saved profile · No diagnosis</p>
        <p>Use invented inputs in the public demo.</p>
      </footer>
    </>
  );
}

function AboutPage() {
  return (
    <main id="main-content" className="about-page">
      <header className="about-hero">
        <p className="eyebrow">Transparent by design</p>
        <h1>Methods &amp; limits</h1>
        <p>
          This research prototype separates a frozen prediction model from a bounded,
          assumption-driven exploration layer. Neither box diagnoses disease or recommends treatment.
        </p>
      </header>

      <section className="method-section" aria-labelledby="population-heading">
        <p className="section-number">01 · Intended use</p>
        <div>
          <h2 id="population-heading">A research prototype for general adults</h2>
          <p>
            The outcome is incident dysglycemia: a first observed transition from fasting blood
            sugar at or below 100 mg/dL to an elevated source label. It is not diagnosed diabetes,
            diabetes onset, or a treatment endpoint. Clinician discussion is encouraged.
          </p>
          <p>
            A probability is withheld when any known FBS is above 100 mg/dL or when no annual FBS
            measurement is available. An unknown earlier history can be scored only from the submitted
            annual measurements and is disclosed as a data-quality note.
          </p>
        </div>
      </section>

      <section className="method-section" aria-labelledby="boxes-heading">
        <p className="section-number">02 · Architecture</p>
        <div>
          <h2 id="boxes-heading">Two evidence boxes</h2>
          <div className="method-cards">
            <article>
              <span>Fixed baseline</span>
              <h3>Model probability</h3>
              <p>
                In the study, five raw ridge-logistic models score separate 1–5 year horizons. The fixed
                preprocessing uses five relative annual slots and excludes calendar year. The public demo substitutes fixed synthetic probabilities and example contributions. Each horizon also shows exact grouped
                log-odds contributions relative to the frozen preprocessing feature-mean reference;
                these explain model arithmetic, not causes or recommended changes.
              </p>
            </article>
            <article>
              <span>External scenarios</span>
              <h3>Non-causal exploration</h3>
              <p>
                Published population associations update baseline survival through
                P₁ = 1 − (1 − P₀)ʳ. Endpoint combinations provide an assumption range, not a personal
                confidence interval or expected treatment effect.
              </p>
            </article>
          </div>
          <p className="boundary-statement">
            Separate work owns model-family benchmarking and monotonic-model comparisons. This BHI
            prototype consumes one frozen baseline release and does not repeat those HealthCom analyses.
          </p>
        </div>
      </section>

      <section className="method-section" aria-labelledby="assumptions-heading">
        <p className="section-number">03 · Assumptions</p>
        <div>
          <h2 id="assumptions-heading">Published multiplier ranges</h2>
          <p>
            All four levers remain exploratory. Odds ratios differ from risk ratios; using a source
            risk ratio as a hazard ratio is an additional simulator assumption, not a validated equivalence.
          </p>
          <p>
            Fruit/vegetable scenarios use a fruit-only association as a proxy. All four sources concern
            incident type 2 diabetes; transfer to this cohort's incident dysglycemia is unvalidated.
          </p>
          <p>
            The implementation and reported experiments use four-decimal rounded multipliers.
            The paper's provenance table displays source-derived conversions at three decimals.
          </p>
          <div className="table-scroll">
            <table className="methods-table">
              <thead><tr><th scope="col">Factor</th><th scope="col">Source association and conversion</th><th scope="col">Simulator unit</th><th scope="col">Point</th><th scope="col">Range</th></tr></thead>
              <tbody>
                <tr><th scope="row">BMI</th><td>Jayedi et al. (2022): RR 1.72 (1.65–1.81) per +5 kg/m²; fifth root.</td><td>per +1 kg/m²</td><td>1.1146</td><td>1.1053–1.1260</td></tr>
                <tr><th scope="row">Exercise</th><td>Smith et al. (2016): RR 0.87 (0.84–0.89) per +10 MET-h/week; assume 2.25 metabolic equivalent task hours per session.</td><td>per +1 session/week</td><td>0.9692</td><td>0.9615–0.9741</td></tr>
                <tr><th scope="row">Fruit/vegetables</th><td>Li et al. (2014): fruit-only RR 0.94 (0.89–1.00) per +1 serving/day; seventh root.</td><td>per +1 serving/week</td><td>0.9912</td><td>0.9835–1.0000</td></tr>
                <tr><th scope="row">Sugar-sweetened drinks</th><td>Imamura et al. (2015): adiposity-adjusted RR 1.13 (1.06–1.21) per +1 serving/day; seventh root.</td><td>per +1 serving/week</td><td>1.0176</td><td>1.0084–1.0276</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="method-section" aria-labelledby="planner-heading">
        <p className="section-number">04 · Ranking</p>
        <div>
          <h2 id="planner-heading">Deterministic, effort-aware alternatives</h2>
          <p>
            The browser enumerates the paper’s direct-BMI grid, filters hard caps, removes clipped
            duplicates, and ranks with a fixed effort penalty of 0.03. Stable sorting makes a fixed
            input reproducible. Five alternatives are shown because the ordering is sensitive to the
            evidence assumptions; rank is not a personal recommendation.
          </p>
        </div>
      </section>

      <section className="method-section limits-section" aria-labelledby="limits-heading">
        <p className="section-number">05 · Limits &amp; privacy</p>
        <div>
          <h2 id="limits-heading">What has not been established</h2>
          <ul>
            <li>No prospective clinical or usability validation has been completed.</li>
            <li>No external validation, causal benefit, adherence, or intervention effect is claimed.</li>
            <li>The scenario range omits baseline-model uncertainty, transportability, interactions, and measurement error.</li>
            <li>Evidence comes from one retrospective cohort; subgroup calibration, especially in smaller and older groups, is uncertain.</li>
            <li>Assessment inputs are sent to the baseline server for temporary processing; scenario adjustments remain in the browser.</li>
            <li>No account, identifier, database, analytics profile, or persistent browser storage is used.</li>
            <li>Infrastructure may log IP addresses and request metadata. No formal privacy or security audit has been completed.</li>
          </ul>
          <a className="text-link" href="/">Return home →</a>
        </div>
      </section>
    </main>
  );
}

export function App() {
  const path = window.location.pathname;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <SiteHeader />
      {path === "/" ? <HomePage /> : null}
      {path === "/assessment" ? <AssessmentFlow /> : null}
      {path === "/scenario-demo" ? <ScenarioDemo /> : null}
      {path === "/about" ? <AboutPage /> : null}
    </div>
  );
}
