import type { BaselineResponse } from "../api/baseline";
import type { PlannerProfile } from "../scenario/planner";
import { ScenarioExplorer } from "../scenario/ScenarioExplorer";
import { ModelExplanation } from "./ModelExplanation";

export function BaselineResult({
  anchors = {},
  onEdit,
  response,
}: {
  anchors?: Partial<PlannerProfile>;
  onEdit: () => void;
  response: BaselineResponse;
}) {
  if (response.status === "outside_applicability") {
    return (
      <main className="result-page" id="main-content">
        <p className="eyebrow">Applicability boundary</p>
        <h1>No baseline probability is shown</h1>
        <p className="result-lead">
          This profile is outside the incident-risk model’s intended starting population.
        </p>
        <div className="notice-list">
          {response.reasons.map((reason) => (
            <p key={reason.code}>{reason.message}</p>
          ))}
        </div>
        <p>Discuss known elevated fasting blood sugar or missing measurements with a clinician.</p>
        <button className="secondary-action" onClick={onEdit} type="button">
          Edit inputs
        </button>
      </main>
    );
  }

  const synthetic = response.model_release.release_id === "synthetic-demo-v1";
  return (
    <main className="result-page" id="main-content">
      <p className="eyebrow">{synthetic ? "Synthetic demo" : "Frozen model estimate"}</p>
      <h1>{synthetic ? "Example baseline trajectory" : "Your baseline trajectory"}</h1>
      <p className="result-lead">
        {synthetic
          ? "Every eligible profile receives these same five illustrative probabilities. Scenario controls use the entered starting values."
          : "These are separate 1–5 year model estimates from the submitted history."}
      </p>
      <ScenarioExplorer anchors={anchors} baseline={response.baseline} />
      <ModelExplanation synthetic={synthetic} explanations={response.explanations} />
      {response.data_quality.length > 0 && (
        <aside className="notice-list" aria-label="Data quality notes">
          {response.data_quality.map((notice) => (
            <p key={notice.code}>{notice.message}</p>
          ))}
        </aside>
      )}
      <p className="release-note">Model release: {response.model_release.release_id}</p>
      <button className="secondary-action" onClick={onEdit} type="button">
        Edit inputs
      </button>
    </main>
  );
}
