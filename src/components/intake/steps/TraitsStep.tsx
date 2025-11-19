import type { FunctionalComponent } from 'preact';

type TraitOption = { label: string; value: string; detail?: string };
type TraitQuestion = {
  name: string;
  label: string;
  description: string;
  options: TraitOption[];
};

const traitQuestions: TraitQuestion[] = [
  {
    name: 'muscle_fiber',
    label: 'Muscle fiber',
    description: 'Which description best matches how you sprint, push, or reset power?',
    options: [
      {
        label: 'Short bursts & quick power',
        value: 'short bursts, quick power',
        detail: 'Explosive, fast-twitch dominance',
      },
      {
        label: 'Balanced burst',
        value: 'balanced',
        detail: 'Comfortable with both sprints & sustained effort',
      },
      {
        label: 'Long efforts & steady control',
        value: 'long efforts, steady control',
        detail: 'Slow-twitch emphasis and pacing',
      },
    ],
  },
  {
    name: 'metabolic_tendency',
    label: 'Metabolic tendency',
    description: 'How does your body respond to training and diet?',
    options: [
      { label: 'Hard to gain weight', value: 'hard to gain weight' },
      { label: 'Easy to tune up', value: 'easy to tune up' },
      { label: 'Weight gains quickly', value: 'weight gains' },
    ],
  },
  {
    name: 'joint_laxity',
    label: 'Joint laxity',
    description: 'Think about how loose or stiff your joints feel during movement.',
    options: [
      { label: 'Low / stiff', value: 'low' },
      { label: 'Medium / average', value: 'medium' },
      { label: 'High / flexible', value: 'high' },
    ],
  },
  {
    name: 'foot_arch',
    label: 'Foot arch',
    description: 'How does your footprint look after a long walk?',
    options: [
      { label: 'Flat / low arch', value: 'flat' },
      { label: 'Neutral arch', value: 'neutral' },
      { label: 'High arch', value: 'high arch' },
    ],
  },
  {
    name: 'temperature_tolerance',
    label: 'Temperature tolerance',
    description: 'What temperature extremes feel most natural?',
    options: [
      { label: 'Cold tolerant', value: 'cold' },
      { label: 'Balanced', value: 'balanced' },
      { label: 'Heat tolerant', value: 'heat' },
    ],
  },
];

const sideOptions: TraitOption[] = [
  { label: 'Right-side dominant', value: 'right' },
  { label: 'Left-side dominant', value: 'left' },
  { label: 'Comfortable with both sides', value: 'both', detail: 'Ambidextrous or switches hands often' },
];

const TraitsStep: FunctionalComponent = () => (
  <div className="card-shell space-y-6" data-step="traits">
    <header className="space-y-2">
      <h2 className="type-title text-slate-900">Physiological traits</h2>
      <p className="text-slate-600">
        These questions help us tune the premium scoring so it respects how your body produces power,
        tolerance, and leverage.
      </p>
    </header>

    <div className="space-y-6">
      {traitQuestions.map((question) => (
        <fieldset key={question.name} className="space-y-3" aria-label={question.label}>
          <legend className="type-body font-semibold text-slate-800">{question.label}</legend>
          {question.description && (
            <p className="text-sm text-slate-500">{question.description}</p>
          )}
          <div className="grid gap-3 md:grid-cols-3">
            {question.options.map((option) => (
              <label
                key={`${question.name}-${option.value}`}
                className="relative cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900"
              >
                <input
                  type="radio"
                  name={question.name}
                  value={option.value}
                  className="sr-only"
                />
                <span className="font-semibold text-slate-800">{option.label}</span>
                {option.detail && (
                  <p className="text-sm text-slate-500">{option.detail}</p>
                )}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <div className="grid gap-4 md:grid-cols-2">
        {['handedness', 'sport_side'].map((field) => {
          const label = field === 'handedness' ? 'Handedness' : 'Sport side';
          const description =
            field === 'handedness'
              ? 'Which hand feels natural for writing, holding, or steadying?'
              : 'Which side do you favor in your signature sport moves?';
          return (
            <fieldset key={field} className="space-y-3" aria-label={label}>
              <legend className="type-body font-semibold text-slate-800">{label}</legend>
              <p className="text-sm text-slate-500">{description}</p>
              <div className="grid gap-3">
                {sideOptions.map((option) => (
                  <label
                    key={`${field}-${option.value}`}
                    className="inline-flex w-full cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900"
                  >
                    <input type="radio" name={field} value={option.value} className="mt-1 h-4 w-4 cursor-pointer" />
                    <span>
                      <span className="font-semibold text-slate-800">{option.label}</span>
                      {option.detail && (
                        <p className="text-sm text-slate-500">{option.detail}</p>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>
    </div>
  </div>
);

export default TraitsStep;
