import { useCallback } from 'preact/hooks';
import type { FunctionalComponent, JSX } from 'preact';

type InputAttrs = JSX.IntrinsicElements['input'] & Record<string, string | any>;
type ButtonAttrs = JSX.IntrinsicElements['button'] & Record<string, string>;

type NumberStepperProps = {
  id?: string;
  name?: string;
  step?: number;
  min?: number;
  max?: number;
  value?: number | string;
  onChange?: (value: number | string) => void;
  required?: boolean;
  inputClassName?: string;
  wrapperClassName?: string;
  inputMode?: string;
  ariaDescribedby?: string;
  inputProps?: InputAttrs;
  decrementProps?: ButtonAttrs;
  incrementProps?: ButtonAttrs;
};

const NumberStepper: FunctionalComponent<NumberStepperProps> = ({
  id,
  name,
  step = 1,
  min,
  max,
  value,
  onChange,
  required = false,
  inputClassName = '',
  wrapperClassName = 'inline-flex items-center overflow-hidden rounded-2xl border border-slate-200 bg-white',
  inputMode,
  ariaDescribedby,
  inputProps,
  decrementProps,
  incrementProps,
}) => {
  const handleStep = useCallback(
    (direction: -1 | 1) => {
      if (!onChange) return;

      const currentVal = value === '' || value === undefined || value === null ? 0 : parseFloat(String(value));
      if (Number.isNaN(currentVal)) return;

      const precision = 1000;
      const stepVal = step;

      let nextVal =
        (Math.round(currentVal * precision) + direction * Math.round(stepVal * precision)) /
        precision;

      if (typeof min === 'number' && nextVal < min) nextVal = min;
      if (typeof max === 'number' && nextVal > max) nextVal = max;

      onChange(nextVal);
    },
    [value, step, min, max, onChange]
  );

  const baseButtonClass =
    'inline-flex h-11 items-center justify-center px-4 text-lg font-semibold text-slate-700 bg-white shrink-0 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500';

  const {
    className: decrementExtraClass,
    ...decrementRest
  } = decrementProps || {};
  const {
    className: incrementExtraClass,
    ...incrementRest
  } = incrementProps || {};
  const decrementClassName = [baseButtonClass, decrementExtraClass]
    .filter(Boolean)
    .join(' ');
  const incrementClassName = [baseButtonClass, incrementExtraClass]
    .filter(Boolean)
    .join(' ');

  const { className: inputExtraClass, onInput, ...inputRest } = inputProps || {};
  const combinedInputClassName =
    [inputClassName, inputExtraClass]
      .filter(Boolean)
      .join(' ') ||
    'h-11 w-24 px-4 text-center text-lg text-slate-900 focus:outline-none focus:ring-0 bg-white';

  return (
    <div className={wrapperClassName}>
      <button
        type="button"
        className={decrementClassName}
        onClick={() => handleStep(-1)}
        {...decrementRest}
      >
        &minus;
      </button>
      <input
        type="number"
        className={combinedInputClassName}
        id={id}
        name={name}
        step={step}
        min={min}
        max={max}
        value={value ?? ''}
        onInput={(e) => {
          onChange?.(e.currentTarget.value);
          if (onInput) onInput(e);
        }}
        inputMode={inputMode}
        aria-describedby={ariaDescribedby}
        required={required}
        {...inputRest}
      />
      <button
        type="button"
        className={incrementClassName}
        onClick={() => handleStep(1)}
        {...incrementRest}
      >
        +
      </button>
    </div>
  );
};

export default NumberStepper;
