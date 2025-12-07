import type { FunctionalComponent } from 'preact';
import type { Sex } from '../../../data/intakeSchema';
import RadioCards from '../controls/RadioCards';

type BasicsStepProps = {
  value: { birthday: string; sex: Sex | '' };
  onChange: (patch: Partial<{ birthday: string; sex: Sex | '' }>) => void;
};

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const BasicsStep: FunctionalComponent<BasicsStepProps> = ({ value, onChange }) => {
  return (
    <div className="card-shell space-y-6" data-step="basics">
      <header className="space-y-2">
        <h2 className="type-title text-slate-900">Let's get started</h2>
        <p className="text-slate-600">
          We use your birthday and sex to place you in the right cohort.
        </p>
      </header>
      <fieldset className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <label className="space-y-2" htmlFor="birthday">
            <span className="type-body block font-semibold text-slate-800">Birthday</span>
            <span className="block text-sm text-slate-500">Used only to infer age brackets.</span>
            <input
              className="input-field"
              type="date"
              name="birthday"
              id="birthday"
              required
              value={value.birthday}
              onInput={(e) => onChange({ birthday: e.currentTarget.value })}
            />
          </label>
          <div className="space-y-2">
            <span className="type-body block font-semibold text-slate-800" id="sex-label">
              Sex
            </span>
            <span className="block text-sm text-slate-500">
              Helps line you up with cohort averages.
            </span>
            <RadioCards
              name="sex"
              value={value.sex}
              options={SEX_OPTIONS}
              onChange={(val) => onChange({ sex: val as Sex })}
              columns="grid-cols-2 md:grid-cols-2"
            />
          </div>
        </div>
      </fieldset>
    </div>
  );
};

export default BasicsStep;
