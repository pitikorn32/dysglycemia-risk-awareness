export interface AnnualMeasurementRequest {
  fbs: number | null;
  bmi: number | null;
  pulse: number | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  waist: number | null;
}

export interface BaselineRequest {
  age: number;
  sex: "male" | "female" | null;
  family_history: "yes" | "no" | "not_sure" | null;
  sugary_drinks_per_week: number | null;
  fruit_vegetable_days_per_week: number | null;
  exercise_days_per_week: number | null;
  physical_activity_days_per_week: number | null;
  sleep_hours: number | null;
  smoking_status: "never" | "former" | "current" | null;
  alcohol_status: "never" | "former" | "current" | null;
  earlier_fbs_over_100: "yes" | "no" | "not_sure";
  earlier_highest_fbs: number | null;
  annual_history: AnnualMeasurementRequest[];
}

export interface HorizonProbability {
  horizon_years: number;
  probability: number;
}

export interface FeatureContribution {
  feature_group: string;
  label: string;
  log_odds_contribution: number;
}

export interface HorizonExplanation {
  horizon_years: number;
  reference_probability: number;
  contributions: FeatureContribution[];
}

export interface ScoredResponse {
  status: "scored";
  baseline: HorizonProbability[];
  explanations: HorizonExplanation[];
  data_quality: Array<{ code: string; message: string }>;
  model_release: { release_id: string; model_family: string; history_years: number };
}

export interface OutsideApplicabilityResponse {
  status: "outside_applicability";
  reasons: Array<{ code: string; message: string }>;
}

export type BaselineResponse = ScoredResponse | OutsideApplicabilityResponse;

export class BaselineApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BaselineApiError";
  }
}

export async function assessBaseline(request: BaselineRequest): Promise<BaselineResponse> {
  const response = await fetch("/api/v1/baseline", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const detail =
      typeof body === "object" && body !== null && "detail" in body && typeof body.detail === "string"
        ? body.detail
        : "The baseline service could not complete this request.";
    throw new BaselineApiError(detail);
  }
  if (
    typeof body !== "object" ||
    body === null ||
    !("status" in body) ||
    (body.status !== "scored" && body.status !== "outside_applicability") ||
    (body.status === "scored" &&
      (!("baseline" in body) ||
        !Array.isArray(body.baseline) ||
        !("explanations" in body) ||
        !Array.isArray(body.explanations)))
  ) {
    throw new BaselineApiError("The baseline service returned an unexpected response.");
  }
  return body as BaselineResponse;
}
