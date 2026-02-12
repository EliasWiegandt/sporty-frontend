import type { FunctionalComponent } from 'preact';

type Option = {
  label: string;
  value: string;
  detail?: string;
};

type RadioCardsProps = {
  name: string;
  value?: string | null;
  defaultValue?: string;
  options: Option[];
  onChange?: (value: string) => void;
  columns?: string; // tailwind grid cols utility, e.g., 'md:grid-cols-3'
  variant?: 'card' | 'row';
};

/**
 * Reusable radio-card group used across intake steps.
 */
const RadioCards: FunctionalComponent<RadioCardsProps> = ({
  name,
  value,
  defaultValue,
  options,
  onChange,
  columns = 'md:grid-cols-3',
  variant = 'card',
}) => {
  const optionClassName =
    variant === 'row'
      ? 'rounded-xl border bg-white px-4 py-3 text-left transition border-slate-200 hover:border-slate-400 focus-within:ring-2 focus-within:ring-slate-900 peer-checked:border-teal-600 peer-checked:bg-teal-50/40 peer-checked:ring-1 peer-checked:ring-teal-200'
      : 'rounded-2xl border bg-white p-4 text-left transition focus-within:ring-2 focus-within:ring-slate-900 border-slate-200 hover:border-slate-900 peer-checked:border-teal-500 peer-checked:shadow-sm peer-checked:ring-1 peer-checked:ring-teal-200';

  return (
    <div className={`grid gap-3 ${columns}`} role="radiogroup" aria-label={name}>
      {options.map((option) => {
        const isControlled = value !== undefined && value !== null;
        const checked = isControlled ? value === option.value : undefined;
        const defaultChecked = !isControlled && option.value === defaultValue;
        return (
          <label key={`${name}-${option.value}`} className="block cursor-pointer">
            <input
              type="radio"
              name={name}
              value={option.value}
              className="peer sr-only"
              {...(checked !== undefined ? { checked } : { defaultChecked })}
              onChange={() => onChange?.(option.value)}
            />
            <div className={optionClassName}>
              <span className="font-semibold text-slate-800">{option.label}</span>
              {option.detail && <p className="text-sm text-slate-500">{option.detail}</p>}
            </div>
          </label>
        );
      })}
    </div>
  );
};

export type { Option as RadioOption };
export default RadioCards;
