export interface AnnualRecord {
  fbs: string;
  bmi: string;
  pulse: string;
  systolicBp: string;
  diastolicBp: string;
  waist: string;
}

export type AnnualField = keyof AnnualRecord;
export type AnnualErrors = Record<string, string>;

export const emptyAnnualHistory: AnnualRecord[] = Array.from({ length: 5 }, () => ({
  fbs: "",
  bmi: "",
  pulse: "",
  systolicBp: "",
  diastolicBp: "",
  waist: "",
}));

const slotNames = ["Four years ago", "Three years ago", "Two years ago", "One year ago", "Current"];

const measurements: Array<{
  field: AnnualField;
  label: string;
  min: number;
  max: number;
}> = [
  { field: "fbs", label: "FBS (mg/dL)", min: 40, max: 600 },
  { field: "bmi", label: "BMI (kg/m²)", min: 10, max: 80 },
  { field: "pulse", label: "Pulse (beats/min)", min: 30, max: 250 },
  { field: "systolicBp", label: "systolic BP (mmHg)", min: 60, max: 300 },
  { field: "diastolicBp", label: "diastolic BP (mmHg)", min: 30, max: 200 },
  { field: "waist", label: "Waist circumference (cm)", min: 30, max: 250 },
];

export function validateAnnualHistory(records: AnnualRecord[]): AnnualErrors {
  const errors: AnnualErrors = {};
  records.forEach((record, index) => {
    measurements.forEach(({ field, min, max }) => {
      const raw = record[field];
      if (raw !== "" && (!Number.isFinite(Number(raw)) || Number(raw) < min || Number(raw) > max)) {
        errors[`${index}.${field}`] = `Use a value from ${min} to ${max}, or leave it blank.`;
      }
    });
    if (
      record.systolicBp !== "" &&
      record.diastolicBp !== "" &&
      Number(record.systolicBp) <= Number(record.diastolicBp)
    ) {
      errors[`${index}.systolicBp`] =
        "Systolic blood pressure must be greater than diastolic blood pressure.";
    }
  });
  return errors;
}

export function AnnualHistoryFields({
  errors,
  onChange,
  records,
}: {
  errors: AnnualErrors;
  onChange: (index: number, field: AnnualField, value: string) => void;
  records: AnnualRecord[];
}) {
  return (
    <div className="annual-history">
      {records.map((record, index) => (
        <fieldset className="annual-record" key={slotNames[index]}>
          <legend>
            <span>{String(index + 1).padStart(2, "0")}</span>
            {slotNames[index]}
          </legend>
          <div className="annual-grid">
            {measurements.map(({ field, label, min, max }) => {
              const id = `annual-${index}-${field}`;
              const error = errors[`${index}.${field}`];
              const accessibleLabel = `${slotNames[index]} ${label}`;
              return (
                <div className="field compact-field" key={field}>
                  <label htmlFor={id}>{accessibleLabel}</label>
                  <input
                    aria-describedby={error ? `${id}-error` : undefined}
                    aria-invalid={Boolean(error)}
                    id={id}
                    max={max}
                    min={min}
                    onChange={(event) => onChange(index, field, event.target.value)}
                    step="any"
                    type="number"
                    value={record[field]}
                  />
                  {error && (
                    <span className="field-error" id={`${id}-error`} role="alert">
                      {error}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
