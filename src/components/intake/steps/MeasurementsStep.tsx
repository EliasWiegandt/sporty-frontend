import type { FunctionalComponent } from 'preact';
import { measurementFields } from '../../../data/measurementFields';
import MeasurementField from '../MeasurementField';

type MeasurementsStepProps = {
  values: Record<string, number | null>;
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
    description: 'Hands, feet, wrists, and ankles capture the fine extremity proportions.',
  },
] as const;

const MeasurementsStep: FunctionalComponent<MeasurementsStepProps> = ({ values, onChange }) => {
  return (
    <div className="card-shell space-y-6" data-step="measurements">
      <header className="space-y-2">
        <h2 className="type-title text-slate-900">Body measurements</h2>
        <p className="text-slate-600">
          Every field below helps benchmark your limbs, torso, and girth so the matching engine can
          find the right sports for your body.
        </p>
      </header>
      <div className="space-y-6">
        {measurementGroupMeta.map((group) => {
          const groupFields = measurementFields.filter((field) => field.group === group.key);
          if (!groupFields.length) return null;
          return (
            <section key={group.key} className="space-y-3">
              <div className="space-y-1">
                <h3 className="type-lead text-slate-700">{group.title}</h3>
                <p className="text-sm text-slate-500">{group.description}</p>
              </div>
              <fieldset className="grid gap-6 md:grid-cols-2">
                {groupFields.map((field) => (
                  <MeasurementField
                    key={field.id}
                    {...field}
                    value={values[field.id] ?? ''}
                    onChange={(val) => onChange({ [field.id]: val })}
                  />
                ))}
              </fieldset>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default MeasurementsStep;
