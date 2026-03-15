import type { FunctionalComponent } from 'preact';
import NumberStepper from './NumberStepper';
import type { MeasurementFieldConfig } from '../../lib/intakeCatalog';
import {
  clampInRange,
  cmToFeetInches,
  cmToIn,
  displayUnitForField,
  formatDisplayNumber,
  inToCm,
  isHeightField,
  toCanonicalMetric,
  toDisplayValue,
  type MeasurementSystem,
} from '../../lib/units';

type Props = MeasurementFieldConfig & {
  value: number | string;
  measurementSystem: MeasurementSystem;
  canonicalId?: string;
  showInstructionTooltip?: boolean;
  onChange: (value: number | null) => void;
};

const parseNumberish = (raw: string | number): number | null => {
  if (raw === '' || raw === null || raw === undefined) {
    return null;
  }
  const num = typeof raw === 'string' ? parseFloat(raw) : raw;
  return Number.isFinite(num) ? num : null;
};

const MeasurementField: FunctionalComponent<Props> = ({
  id,
  label,
  hint,
  help,
  min,
  max,
  step = 1,
  required = true,
  value,
  measurementSystem,
  canonicalId,
  showInstructionTooltip = false,
  onChange,
}) => {
  const fieldId = canonicalId || id;
  const unit = displayUnitForField(fieldId, measurementSystem);
  const showInlineHint = Boolean(hint) && !showInstructionTooltip;
  const hintId = showInlineHint ? `${id}-hint` : undefined;
  const tooltipId = `${id}-tooltip`;
  const tooltipSteps =
    Array.isArray(help) && help.length
      ? help
      : hint
        ? [hint]
        : [];

  const metricValue = parseNumberish(value as string | number);
  const imperialHeight = measurementSystem === 'imperial' && isHeightField(fieldId);

  const handleSingleValueChange = (raw: string | number) => {
    const parsed = parseNumberish(raw);
    if (parsed === null) {
      onChange(null);
      return;
    }
    const canonical = toCanonicalMetric(fieldId, parsed, measurementSystem);
    onChange(Number.isFinite(canonical) ? canonical : null);
  };

  const displayMin = measurementSystem === 'metric' ? min : toDisplayValue(fieldId, min, measurementSystem);
  const displayMax = measurementSystem === 'metric' ? max : toDisplayValue(fieldId, max, measurementSystem);
  const displayStep = measurementSystem === 'metric'
    ? step
    : fieldId === 'weight_kg'
      ? 0.5
      : 0.1;

  const displayValue = metricValue === null
    ? ''
    : formatDisplayNumber(toDisplayValue(fieldId, metricValue, measurementSystem));

  const heightDisplay = metricValue === null ? { feet: null, inches: null } : cmToFeetInches(metricValue);
  const minInches = cmToIn(min);
  const maxInches = cmToIn(max);

  const setImperialHeight = (feet: number | null, inches: number | null) => {
    if (feet === null || inches === null) {
      onChange(null);
      return;
    }

    let normalizedFeet = feet;
    let normalizedInches = inches;

    if (normalizedInches >= 12) {
      const carry = Math.floor(normalizedInches / 12);
      normalizedFeet += carry;
      normalizedInches -= carry * 12;
    }

    if (normalizedInches < 0) {
      const borrow = Math.ceil(Math.abs(normalizedInches) / 12);
      normalizedFeet -= borrow;
      normalizedInches += borrow * 12;
    }

    normalizedInches = clampInRange(normalizedInches, 0, 11.5);

    const unclampedTotalInches = normalizedFeet * 12 + normalizedInches;
    const clampedTotalInches = clampInRange(unclampedTotalInches, minInches, maxInches);
    onChange(inToCm(clampedTotalInches));
  };

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white px-4 py-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <label className="type-body font-semibold text-slate-800" htmlFor={id}>
              {label} ({unit})
            </label>
            {showInstructionTooltip && tooltipSteps.length > 0 && (
              <span className="info-tip-wrap">
                <button
                  type="button"
                  className="info-tip-trigger"
                  aria-label={`How to measure ${label.toLowerCase()}`}
                  aria-describedby={tooltipId}
                >
                  i
                </button>
                <span id={tooltipId} role="tooltip" className="info-tip-content">
                  <span className="info-tip-title">How to measure</span>
                  <ul className="info-tip-list">
                    {tooltipSteps.map((stepText) => (
                      <li key={stepText}>{stepText}</li>
                    ))}
                  </ul>
                </span>
              </span>
            )}
          </div>
          {showInlineHint && (
            <p id={hintId} className="text-sm text-slate-500">
              {hint}
            </p>
          )}
        </div>
      </div>

      {imperialHeight ? (
        <div className="flex w-full max-w-md gap-3">
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Feet</div>
            <NumberStepper
              id={id}
              name={`${id}-feet`}
              step={1}
              min={Math.floor(minInches / 12)}
              max={Math.ceil(maxInches / 12)}
              value={heightDisplay.feet ?? ''}
              onChange={(raw) => {
                const feet = parseNumberish(raw);
                setImperialHeight(feet, heightDisplay.inches ?? 0);
              }}
              required={required}
              inputMode="numeric"
              ariaDescribedby={hintId}
              wrapperClassName="inline-flex w-full items-center overflow-hidden rounded-2xl border border-slate-200 bg-white"
              inputClassName="h-11 w-full px-3 text-right text-lg text-slate-900 focus:outline-none focus:ring-0 bg-white"
              decrementProps={{
                'aria-label': `Decrease ${label.toLowerCase()} feet`,
                className: 'border-r border-slate-200',
              }}
              incrementProps={{
                'aria-label': `Increase ${label.toLowerCase()} feet`,
                className: 'border-l border-slate-200',
              }}
            />
          </div>
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Inches</div>
            <NumberStepper
              id={`${id}-inches`}
              name={`${id}-inches`}
              step={0.5}
              min={0}
              max={11.5}
              value={heightDisplay.inches ?? ''}
              onChange={(raw) => {
                const inches = parseNumberish(raw);
                setImperialHeight(heightDisplay.feet ?? 0, inches);
              }}
              required={required}
              inputMode="decimal"
              ariaDescribedby={hintId}
              wrapperClassName="inline-flex w-full items-center overflow-hidden rounded-2xl border border-slate-200 bg-white"
              inputClassName="h-11 w-full px-3 text-right text-lg text-slate-900 focus:outline-none focus:ring-0 bg-white"
              decrementProps={{
                'aria-label': `Decrease ${label.toLowerCase()} inches`,
                className: 'border-r border-slate-200',
              }}
              incrementProps={{
                'aria-label': `Increase ${label.toLowerCase()} inches`,
                className: 'border-l border-slate-200',
              }}
            />
          </div>
        </div>
      ) : (
        <NumberStepper
          id={id}
          name={id}
          step={displayStep}
          min={displayMin}
          max={displayMax}
          value={displayValue}
          onChange={handleSingleValueChange}
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
      )}
    </div>
  );
};

export default MeasurementField;
