import type { FunctionalComponent } from 'preact';
import type { MeasurementFieldConfig } from '../../../data/measurementFields';
import MeasurementField from '../MeasurementField';
import InlineInfoTip from '../InlineInfoTip';
import type { MeasurementSystem } from '../../../lib/units';

type MeasurementsStepProps = {
  mode: 'free' | 'premium';
  fields: MeasurementFieldConfig[];
  values: Record<string, number | null>;
  measurementSystem: MeasurementSystem;
  onMeasurementSystemChange: (next: MeasurementSystem) => void;
  onChange: (patch: Record<string, number | null>) => void;
};

const measurementGroupMeta = [
  {
    key: 'core',
    title: 'Core linear metrics',
    description: 'Height, weight, span, and inseam anchor the body’s overall scale.',
  },
  {
    key: 'torso',
    title: 'Width & torso length',
    description: 'Shoulders, hips, and torso length describe the body’s width profile.',
  },
  {
    key: 'extremities',
    title: 'Extremities & girth',
    descriptionByMode: {
      free: 'Quick mode keeps the highest-signal extremity metric: wrist circumference.',
      premium: 'Hands, feet, wrists, and ankles capture the fine extremity proportions.',
    },
  },
] as const;

const QUICK_SECTIONS: Array<{
  key: 'fast_start' | 'tape_measurements';
  title: string;
  subtitle: string;
}> = [
  {
    key: 'fast_start',
    title: 'Fast start',
    subtitle: 'Start with scale + core body size.',
  },
  {
    key: 'tape_measurements',
    title: 'Tape measurements',
    subtitle: 'Use a tape measure for body proportions.',
  },
];

const MeasurementsStep: FunctionalComponent<MeasurementsStepProps> = ({
  mode,
  fields,
  values,
  measurementSystem,
  onMeasurementSystemChange,
  onChange,
}) => {
  return (
    <div className="card-shell space-y-6" data-step="measurements">
      <header className="space-y-2">
        <h2 className="type-title text-slate-900">Body measurements</h2>
        <p className="text-slate-600">
          {mode === 'free'
            ? 'Quick analysis uses a reduced measurement set for faster completion.'
            : 'Every field below helps benchmark your limbs, torso, and girth so the matching engine can find the right sports for your body.'}
        </p>
        <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            className={`px-3 py-1.5 text-sm rounded-full transition ${measurementSystem === 'metric' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            onClick={() => onMeasurementSystemChange('metric')}
            aria-pressed={measurementSystem === 'metric'}
          >
            Metric (cm/kg)
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 text-sm rounded-full transition ${measurementSystem === 'imperial' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            onClick={() => onMeasurementSystemChange('imperial')}
            aria-pressed={measurementSystem === 'imperial'}
          >
            Imperial (ft/in, lb)
          </button>
        </div>
      </header>
      {mode === 'free' ? (
        <div className="space-y-6">
          {QUICK_SECTIONS.map((section) => {
            const sectionFields = fields
              .filter((field) => field.quick_section === section.key)
              .sort((a, b) => (a.quick_order ?? Number.MAX_SAFE_INTEGER) - (b.quick_order ?? Number.MAX_SAFE_INTEGER));
            if (!sectionFields.length) return null;
            return (
              <section key={section.key} className="space-y-3">
                <div className="space-y-1">
                  <h3 className="type-lead text-slate-700">{section.title}</h3>
                  <p className="text-sm text-slate-500">{section.subtitle}</p>
                </div>
                <fieldset className="grid gap-6 md:grid-cols-2">
                  {sectionFields.map((field) => (
                    <MeasurementField
                      key={field.id}
                      {...field}
                      hint={field.hint}
                      measurementSystem={measurementSystem}
                      showInstructionTooltip
                      value={values[field.id] ?? ''}
                      onChange={(val) => onChange({ [field.id]: val })}
                    />
                  ))}
                </fieldset>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="space-y-6">
          {measurementGroupMeta.map((group) => {
            const groupFields = fields.filter((field) => field.group === group.key);
            if (!groupFields.length) return null;
            return (
              <section key={group.key} className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="type-lead text-slate-700">{group.title}</h3>
                    <InlineInfoTip
                      id={`premium-${group.key}-tip`}
                      label={group.title}
                      steps={[
                        'descriptionByMode' in group
                          ? group.descriptionByMode[mode]
                          : group.description,
                      ]}
                    />
                  </div>
                </div>
                <fieldset className="grid gap-6 md:grid-cols-2">
                  {groupFields.map((field) => (
                    <MeasurementField
                      key={field.id}
                      {...field}
                      measurementSystem={measurementSystem}
                      showInstructionTooltip
                      value={values[field.id] ?? ''}
                      onChange={(val) => onChange({ [field.id]: val })}
                    />
                  ))}
                </fieldset>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MeasurementsStep;
