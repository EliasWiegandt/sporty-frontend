import type { FunctionalComponent } from 'preact';
import RadioCards from '../controls/RadioCards';
import InlineInfoTip from '../InlineInfoTip';
import type { TraitAnswers } from '../../../data/intakeSchema';

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
    label: 'Muscle burst vs. endurance',
    description: 'Which feels most natural in workouts?',
    options: [
      {
        label: 'Short, explosive bursts suit me',
        value: 'fast_twitch_dominant',
      },
      {
        label: 'I’m better at steady, long efforts',
        value: 'slow_twitch_dominant',
      },
      {
        label: 'Pretty even between bursts and steady',
        value: 'balanced',
      },
      { label: 'Don’t know', value: "don't know" },
    ],
  },
  {
    name: 'metabolic_tendency',
    label: 'Weight-change tendency',
    description: 'If you stop tracking food for a month, you usually…',
    options: [
      { label: 'Gain weight easily', value: 'endomorph' },
      { label: 'Stay about the same', value: 'mesomorph' },
      { label: 'Lose weight easily', value: 'ectomorph' },
      { label: 'Don’t know', value: "don't know" },
    ],
  },
  {
    name: 'joint_laxity',
    label: 'Flexibility / laxity',
    description: 'How do your elbows/knees feel and move?',
    options: [
      { label: 'Very bendy / goes past straight', value: 'high' },
      { label: 'Average, moves normally', value: 'medium' },
      { label: 'Feels tight / limited range', value: 'low' },
      { label: 'Don’t know', value: "don't know" },
    ],
  },
  {
    name: 'foot_arch',
    label: 'Foot arch',
    description: 'Your wet footprint leaves…',
    options: [
      { label: 'Mostly a straight edge (low arch/flat)', value: 'flat' },
      { label: 'A moderate curve (neutral arch)', value: 'neutral' },
      { label: 'A narrow mid-foot (high arch)', value: 'high' },
      { label: 'Don’t know', value: "don't know" },
    ],
  },
  {
    name: 'temperature_tolerance',
    label: 'Heat vs. cold comfort',
    description: 'During hard sessions, which bothers you first?',
    options: [
      { label: 'I overheat quickly', value: 'heat_tolerant' },
      { label: 'I chill easily / cold hands and feet', value: 'cold_tolerant' },
      { label: 'Both heat and cold are fine', value: 'balanced' },
      { label: 'Don’t know', value: "don't know" },
    ],
  },
];

const sideOptions: TraitOption[] = [
  { label: 'Right', value: 'right' },
  { label: 'Left', value: 'left' },
  { label: 'Either / both', value: 'both', detail: 'Ambidextrous or switches often' },
  { label: 'Don’t know', value: "don't know" },
];

type TraitsStepProps = {
  value: TraitAnswers;
  onChange: (patch: Partial<TraitAnswers>) => void;
};

const TraitsStep: FunctionalComponent<TraitsStepProps> = ({ value, onChange }) => (
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
          <legend className="type-body flex items-center gap-2 font-semibold text-slate-800">
            {question.label}
            {question.description && (
              <InlineInfoTip
                id={`${question.name}-tip`}
                label={question.label}
                steps={[question.description]}
              />
            )}
          </legend>
              <RadioCards
                name={question.name}
                value={value[question.name as keyof TraitAnswers] ?? undefined}
                options={question.options}
                onChange={(nextValue) =>
              onChange({
                [question.name]: nextValue,
              } as Partial<TraitAnswers>)
            }
          />
        </fieldset>
      ))}

      <div className="grid gap-4 md:grid-cols-2">
        {['handedness', 'footedness'].map((field) => {
          const label = field === 'handedness' ? 'Handedness' : 'Footedness';
          const description =
            field === 'handedness'
              ? 'Which hand do you throw/serve/write with most?'
              : 'Which leg do you naturally kick or jump off with?';
          return (
            <fieldset key={field} className="space-y-3" aria-label={label}>
              <legend className="type-body flex items-center gap-2 font-semibold text-slate-800">
                {label}
                <InlineInfoTip
                  id={`${field}-tip`}
                  label={label}
                  steps={[description]}
                />
              </legend>
              <RadioCards
                name={field}
                value={value[field as keyof TraitAnswers] ?? undefined}
                options={sideOptions}
                columns="grid-cols-1"
                onChange={(nextValue) =>
                  onChange({
                    [field]: nextValue,
                  } as Partial<TraitAnswers>)
                }
              />
            </fieldset>
          );
        })}
      </div>
    </div>
  </div>
);

export default TraitsStep;
