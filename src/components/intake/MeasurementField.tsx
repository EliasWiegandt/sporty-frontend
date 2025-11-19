import type { FunctionalComponent } from 'preact';
import NumberStepper from './NumberStepper';
import type { MeasurementFieldConfig } from '../../data/measurementFields';

type Props = MeasurementFieldConfig & {
  value: number | string;
  onChange: (value: number | null) => void;
};

const MeasurementField: FunctionalComponent<Props> = ({
  id,
  label,
  unit,
  hint,
  min,
  max,
  step = 1,
  required = true,
  value,
  onChange,
}) => {
  const hintId = hint ? `${id}-hint` : undefined;

  const handleChange = (raw: string | number) => {
    if (raw === '' || raw === null || raw === undefined) {
      onChange(null);
      return;
    }
    const num = typeof raw === 'string' ? parseFloat(raw) : raw;
    onChange(Number.isNaN(num) ? null : num);
  };

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white px-4 py-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <label className="type-body font-semibold text-slate-800" htmlFor={id}>
            {label} ({unit})
          </label>
          {hint && (
            <p id={hintId} className="text-sm text-slate-500">
              {hint}
            </p>
          )}
        </div>
      </div>

      <NumberStepper
        id={id}
        name={id}
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={handleChange}
        required={required}
        inputMode="decimal"
        ariaDescribedby={hintId}
        wrapperClassName="inline-flex w-full max-w-md items-center overflow-hidden rounded-2xl border border-slate-200 bg-white"
        inputClassName="h-11 w-full px-4 text-right text-lg text-slate-900 focus:outline-none focus:ring-0 bg-white"
        decrementProps={{
          'aria-label': `Decrease ${label.toLowerCase()}`,
          className: 'border-r border-slate-200',
        }}
        incrementProps={{
          'aria-label': `Increase ${label.toLowerCase()}`,
          className: 'border-l border-slate-200',
        }}
      />
    </div>
  );
};

export default MeasurementField;

