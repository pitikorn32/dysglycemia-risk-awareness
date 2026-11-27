import { useState } from "react";

import {
  assessBaseline,
  type BaselineRequest,
  type BaselineResponse,
} from "../api/baseline";
import { BaselineResult } from "../results/BaselineResult";
import type { PlannerProfile } from "../scenario/planner";
import {
  AnnualHistoryFields,
  type AnnualField,
  type AnnualRecord,
  emptyAnnualHistory,
  validateAnnualHistory,
} from "./AnnualHistoryFields";

type Sex = "" | "male" | "female";
type FamilyHistory = "" | "yes" | "no" | "not_sure";
type Status = "" | "never" | "former" | "current";
type EarlierFbs = "" | "yes" | "no" | "not_sure";

interface AssessmentDraft {
  age: string;
  sex: Sex;
  familyHistory: FamilyHistory;
  sugaryDrinks: string;
  fruitVegetable: string;
  exercise: string;
  physicalActivity: string;
  sleep: string;
  smoking: Status;
  alcohol: Status;
  earlierFbs: EarlierFbs;
  earlierHighestFbs: string;
  annualHistory: AnnualRecord[];
}

const stepTitles = [
  "About you",
  "Everyday patterns",
  "Earlier blood sugar",
  "Five-year health history",
  "Review",
];

const initialDraft: AssessmentDraft = {
  age: "",
  sex: "",
  familyHistory: "",
  sugaryDrinks: "",
  fruitVegetable: "",
  exercise: "",
  physicalActivity: "",
  sleep: "",
  smoking: "",
  alcohol: "",
  earlierFbs: "",
  earlierHighestFbs: "",
  annualHistory: emptyAnnualHistory,
};

function Choice({
  checked,
  label,
  name,
  onChange,
  value,
}: {
  checked: boolean;
  label: string;
  name: string;
  onChange: () => void;
  value: string;
}) {
  return (
    <label className="choice">
      <input checked={checked} name={name} onChange={onChange} type="radio" value={value} />
      <span>{label}</span>
    </label>
  );
}

function AboutYou({
  draft,
  error,
  update,
}: {
  draft: AssessmentDraft;
  error: string;
  update: (patch: Partial<AssessmentDraft>) => void;
}) {
  return (
    <div className="form-stack">
      <div className="field">
        <label htmlFor="age">Age</label>
        <input
          aria-describedby={error ? "age-error" : "age-help"}
          aria-invalid={Boolean(error)}
          id="age"
          inputMode="numeric"
          max="100"
          min="18"
          onChange={(event) => update({ age: event.target.value })}
          required
          type="number"
          value={draft.age}
        />
        <small id="age-help">The prototype is designed for adults aged 18–100.</small>
        {error && (
          <span className="field-error" id="age-error" role="alert">
            {error}
          </span>
        )}
      </div>

      <div className="field">
        <label htmlFor="sex">Sex (optional)</label>
        <select
          id="sex"
          onChange={(event) => update({ sex: event.target.value as Sex })}
          value={draft.sex}
        >
          <option value="">Prefer not to answer</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </div>

      <fieldset>
        <legend>Family history of diabetes (optional)</legend>
        <div className="choice-row">
          <Choice
            checked={draft.familyHistory === "yes"}
            label="Yes"
            name="family-history"
            onChange={() => update({ familyHistory: "yes" })}
            value="yes"
          />
          <Choice
            checked={draft.familyHistory === "no"}
            label="No"
            name="family-history"
            onChange={() => update({ familyHistory: "no" })}
            value="no"
          />
          <Choice
            checked={draft.familyHistory === "not_sure"}
            label="Not sure"
            name="family-history"
            onChange={() => update({ familyHistory: "not_sure" })}
            value="not_sure"
          />
        </div>
        <small>Not sure and omitted answers use the frozen model's missing-value handling.</small>
      </fieldset>
    </div>
  );
}

function OptionalNumber({
  error,
  help,
  id,
  label,
  max,
  onChange,
  value,
}: {
  error?: string;
  help?: string;
  id: string;
  label: string;
  max: number;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        aria-describedby={[help && `${id}-help`, error && `${id}-error`].filter(Boolean).join(" ") || undefined}
        aria-invalid={Boolean(error)}
        id={id}
        max={max}
        min="0"
        onChange={(event) => onChange(event.target.value)}
        step="any"
        type="number"
        value={value}
      />
      {help && <small id={`${id}-help`}>{help}</small>}
      {error && (
        <span className="field-error" id={`${id}-error`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

function StatusSelect({
  id,
  label,
  onChange,
  value,
}: {
  id: string;
  label: string;
  onChange: (value: Status) => void;
  value: Status;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} onChange={(event) => onChange(event.target.value as Status)} value={value}>
        <option value="">Prefer not to answer</option>
        <option value="never">Never</option>
        <option value="former">Former</option>
        <option value="current">Current</option>
      </select>
    </div>
  );
}

function EverydayPatterns({
  draft,
  errors,
  update,
}: {
  draft: AssessmentDraft;
  errors: Record<string, string>;
  update: (patch: Partial<AssessmentDraft>) => void;
}) {
  return (
    <div className="form-stack two-column-fields">
      <OptionalNumber
        error={errors.sugaryDrinks}
        id="sugary-drinks"
        label="Sugar-sweetened drinks per week (optional)"
        max={42}
        onChange={(value) => update({ sugaryDrinks: value })}
        value={draft.sugaryDrinks}
      />
      <OptionalNumber
        error={errors.fruitVegetable}
        help="Baseline uses the reported weekly frequency unchanged. Scenarios assume one serving per occasion; this serving proxy is unvalidated."
        id="fruit-vegetable"
        label="Fruit or vegetable times per week (optional)"
        max={21}
        onChange={(value) => update({ fruitVegetable: value })}
        value={draft.fruitVegetable}
      />
      <OptionalNumber
        error={errors.exercise}
        id="exercise"
        label="Exercise sessions per week (optional)"
        max={14}
        onChange={(value) => update({ exercise: value })}
        value={draft.exercise}
      />
      <OptionalNumber
        error={errors.physicalActivity}
        help="Weekly frequency, not distinct days. The original questionnaire unit is unverified; leave blank if unknown."
        id="physical-activity"
        label="Physical activity frequency per week (optional)"
        max={14}
        onChange={(value) => update({ physicalActivity: value })}
        value={draft.physicalActivity}
      />
      <OptionalNumber
        error={errors.sleep}
        id="sleep"
        label="Typical sleep hours per day (optional)"
        max={24}
        onChange={(value) => update({ sleep: value })}
        value={draft.sleep}
      />
      <StatusSelect
        id="smoking"
        label="Smoking status (optional)"
        onChange={(value) => update({ smoking: value })}
        value={draft.smoking}
      />
      <StatusSelect
        id="alcohol"
        label="Alcohol status (optional)"
        onChange={(value) => update({ alcohol: value })}
        value={draft.alcohol}
      />
    </div>
  );
}

function EarlierBloodSugar({
  draft,
  errors,
  update,
}: {
  draft: AssessmentDraft;
  errors: Record<string, string>;
  update: (patch: Partial<AssessmentDraft>) => void;
}) {
  return (
    <div className="form-stack">
      <fieldset aria-describedby={errors.earlierFbs ? "earlier-fbs-error" : "earlier-fbs-help"}>
        <legend>Before these five annual records, was any fasting blood sugar above 100 mg/dL?</legend>
        <p className="field-help" id="earlier-fbs-help">
          Answer Not sure if earlier records are incomplete.
        </p>
        <div className="choice-row">
          <Choice
            checked={draft.earlierFbs === "yes"}
            label="Yes"
            name="earlier-fbs"
            onChange={() => update({ earlierFbs: "yes" })}
            value="yes"
          />
          <Choice
            checked={draft.earlierFbs === "no"}
            label="No"
            name="earlier-fbs"
            onChange={() => update({ earlierFbs: "no" })}
            value="no"
          />
          <Choice
            checked={draft.earlierFbs === "not_sure"}
            label="Not sure"
            name="earlier-fbs"
            onChange={() => update({ earlierFbs: "not_sure" })}
            value="not_sure"
          />
        </div>
        {errors.earlierFbs && (
          <p className="field-error" id="earlier-fbs-error" role="alert">
            {errors.earlierFbs}
          </p>
        )}
      </fieldset>
      <div className="field">
        <label htmlFor="earlier-highest-fbs">Highest earlier FBS in mg/dL (optional)</label>
        <input
          aria-describedby={errors.earlierHighestFbs ? "earlier-highest-fbs-error" : undefined}
          aria-invalid={Boolean(errors.earlierHighestFbs)}
          id="earlier-highest-fbs"
          max="600"
          min="40"
          onChange={(event) => update({ earlierHighestFbs: event.target.value })}
          step="any"
          type="number"
          value={draft.earlierHighestFbs}
        />
        {errors.earlierHighestFbs && (
          <span className="field-error" id="earlier-highest-fbs-error" role="alert">
            {errors.earlierHighestFbs}
          </span>
        )}
      </div>
      <aside className="information-note">
        A known result above 100 mg/dL is outside this incident-risk model’s applicability. The
        prototype will explain that boundary instead of showing a probability.
      </aside>
    </div>
  );
}

function optionalNumber(value: string): number | null {
  return value === "" ? null : Number(value);
}

function buildBaselineRequest(draft: AssessmentDraft): BaselineRequest {
  if (!draft.earlierFbs) throw new Error("Earlier FBS applicability answer is required.");
  return {
    age: Number(draft.age),
    sex: draft.sex || null,
    family_history: draft.familyHistory || null,
    sugary_drinks_per_week: optionalNumber(draft.sugaryDrinks),
    fruit_vegetable_days_per_week: optionalNumber(draft.fruitVegetable),
    exercise_days_per_week: optionalNumber(draft.exercise),
    physical_activity_days_per_week: optionalNumber(draft.physicalActivity),
    sleep_hours: optionalNumber(draft.sleep),
    smoking_status: draft.smoking || null,
    alcohol_status: draft.alcohol || null,
    earlier_fbs_over_100: draft.earlierFbs,
    earlier_highest_fbs: optionalNumber(draft.earlierHighestFbs),
    annual_history: draft.annualHistory.map((record) => ({
      fbs: optionalNumber(record.fbs),
      bmi: optionalNumber(record.bmi),
      pulse: optionalNumber(record.pulse),
      systolic_bp: optionalNumber(record.systolicBp),
      diastolic_bp: optionalNumber(record.diastolicBp),
      waist: optionalNumber(record.waist),
    })),
  };
}

function buildPlannerAnchors(draft: AssessmentDraft): Partial<PlannerProfile> {
  const current = draft.annualHistory[4];
  return {
    ...(current.bmi !== "" ? { bmi: Number(current.bmi) } : {}),
    ...(draft.exercise !== "" ? { exercise: Number(draft.exercise) } : {}),
    ...(draft.fruitVegetable !== "" ? { fruitVegetable: Number(draft.fruitVegetable) } : {}),
    ...(draft.sugaryDrinks !== "" ? { sugaryDrinks: Number(draft.sugaryDrinks) } : {}),
  };
}

function Review({ draft }: { draft: AssessmentDraft }) {
  const knownAnnualFbs = draft.annualHistory.filter((record) => record.fbs !== "").length;
  return (
    <div className="review-grid">
      <section>
        <span>About you</span>
        <strong>Age {draft.age}</strong>
        <p>{draft.sex ? draft.sex[0].toUpperCase() + draft.sex.slice(1) : "Sex not provided"}</p>
      </section>
      <section>
        <span>Earlier FBS</span>
        <strong>{draft.earlierFbs === "not_sure" ? "Not sure" : draft.earlierFbs === "yes" ? "Yes" : "No"}</strong>
        <p>{draft.earlierHighestFbs ? `${draft.earlierHighestFbs} mg/dL reported` : "No value provided"}</p>
      </section>
      <section>
        <span>Annual history</span>
        <strong>{knownAnnualFbs} of 5 FBS slots</strong>
        <p>Other missing measurements remain blank.</p>
      </section>
      <aside className="information-note">
        Submit once to the same-origin baseline service. The request is not stored and the
        response is marked no-store.
      </aside>
    </div>
  );
}

export function AssessmentFlow() {
  const [draft, setDraft] = useState(initialDraft);
  const [step, setStep] = useState(0);
  const [ageError, setAgeError] = useState("");
  const [lifestyleErrors, setLifestyleErrors] = useState<Record<string, string>>({});
  const [earlierFbsErrors, setEarlierFbsErrors] = useState<Record<string, string>>({});
  const [annualErrors, setAnnualErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<BaselineResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const update = (patch: Partial<AssessmentDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    if (patch.age !== undefined) setAgeError("");
    setLifestyleErrors((current) => {
      const next = { ...current };
      Object.keys(patch).forEach((key) => delete next[key]);
      return next;
    });
    setEarlierFbsErrors((current) => {
      const next = { ...current };
      Object.keys(patch).forEach((key) => delete next[key]);
      return next;
    });
  };

  const updateAnnual = (index: number, field: AnnualField, value: string) => {
    setDraft((current) => ({
      ...current,
      annualHistory: current.annualHistory.map((record, recordIndex) =>
        recordIndex === index ? { ...record, [field]: value } : record,
      ),
    }));
    setAnnualErrors((current) => {
      const next = { ...current };
      delete next[`${index}.${field}`];
      return next;
    });
  };

  const continueForward = () => {
    if (step === 0) {
      const age = Number(draft.age);
      if (!draft.age || !Number.isInteger(age) || age < 18 || age > 100) {
        setAgeError("Enter an age from 18 to 100.");
        return;
      }
    }
    if (step === 1) {
      const limits: Array<[keyof AssessmentDraft, number]> = [
        ["sugaryDrinks", 42],
        ["fruitVegetable", 21],
        ["exercise", 14],
        ["physicalActivity", 14],
        ["sleep", 24],
      ];
      const errors: Record<string, string> = {};
      limits.forEach(([key, max]) => {
        const raw = draft[key];
        if (typeof raw === "string" && raw !== "" && (Number(raw) < 0 || Number(raw) > max)) {
          errors[key] = `Use a value from 0 to ${max}, or leave it blank.`;
        }
      });
      if (Object.keys(errors).length > 0) {
        setLifestyleErrors(errors);
        return;
      }
    }
    if (step === 2) {
      const errors: Record<string, string> = {};
      if (!draft.earlierFbs) errors.earlierFbs = "Choose Yes, No, or Not sure.";
      if (
        draft.earlierHighestFbs !== "" &&
        (Number(draft.earlierHighestFbs) < 40 || Number(draft.earlierHighestFbs) > 600)
      ) {
        errors.earlierHighestFbs = "Use a value from 40 to 600 mg/dL, or leave it blank.";
      }
      if (Object.keys(errors).length > 0) {
        setEarlierFbsErrors(errors);
        return;
      }
    }
    if (step === 3) {
      const errors = validateAnnualHistory(draft.annualHistory);
      if (Object.keys(errors).length > 0) {
        setAnnualErrors(errors);
        return;
      }
    }
    setStep((current) => Math.min(current + 1, stepTitles.length - 1));
  };

  const submit = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      setResult(await assessBaseline(buildBaselineRequest(draft)));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "The baseline request failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <BaselineResult
        anchors={buildPlannerAnchors(draft)}
        onEdit={() => setResult(null)}
        response={result}
      />
    );
  }

  return (
    <main className="assessment-page" id="main-content">
      <aside className="assessment-intro">
        <p className="eyebrow">Anonymous assessment</p>
        <h1>A five-part snapshot</h1>
        <p>
          Use invented inputs. The public demo checks eligibility and returns the same synthetic baseline and example explanations for every eligible profile. Optional fields may be left blank.
        </p>
        <ol className="step-list" aria-label="Assessment progress">
          {stepTitles.map((title, index) => (
            <li aria-current={index === step ? "step" : undefined} key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {title}
            </li>
          ))}
        </ol>
      </aside>

      <section className="assessment-card" aria-labelledby="step-title">
        <p className="section-number">Step {step + 1} of 5</p>
        <h2 id="step-title">{stepTitles[step]}</h2>
        <p className="step-description">
          {step === 0 && "These details help place your health history in context."}
          {step === 1 && "Share only the patterns you know; every field here is optional."}
          {step === 2 && "This answer determines whether the incident-risk model applies."}
          {step === 3 && "Enter up to five relative annual records, ordered oldest to current."}
          {step === 4 && "Check the summary before requesting the baseline result."}
        </p>
        {step === 0 ? <AboutYou draft={draft} error={ageError} update={update} /> : null}
        {step === 1 ? (
          <EverydayPatterns draft={draft} errors={lifestyleErrors} update={update} />
        ) : null}
        {step === 2 ? (
          <EarlierBloodSugar draft={draft} errors={earlierFbsErrors} update={update} />
        ) : null}
        {step === 3 ? (
          <AnnualHistoryFields
            errors={annualErrors}
            onChange={updateAnnual}
            records={draft.annualHistory}
          />
        ) : null}
        {step === 4 ? <Review draft={draft} /> : null}
        {submitError && (
          <p className="submit-error" role="alert">
            {submitError}
          </p>
        )}
        <div className="form-actions">
          {step > 0 && (
            <button className="secondary-action" onClick={() => setStep(step - 1)} type="button">
              ← Back
            </button>
          )}
          {step < stepTitles.length - 1 && (
            <button className="primary-action" onClick={continueForward} type="button">
              Continue <span aria-hidden="true">→</span>
            </button>
          )}
          {step === stepTitles.length - 1 && (
            <button className="primary-action" disabled={submitting} onClick={submit} type="button">
              {submitting ? "Calculating…" : "Calculate baseline"}
            </button>
          )}
        </div>
        <p className="session-note">Nothing is saved when you close or refresh this page.</p>
      </section>
    </main>
  );
}
