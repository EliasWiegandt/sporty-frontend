import type { FunctionalComponent } from 'preact';
import RadioCards from '../controls/RadioCards';
import InlineInfoTip from '../InlineInfoTip';
import type { TraitAnswers } from '../../../data/intakeSchema';
import type { TraitCatalogQuestion } from '../../../lib/intakeCatalog';

type TraitsStepProps = {
  value: TraitAnswers;
  onChange: (patch: Partial<TraitAnswers>) => void;
  questions: TraitCatalogQuestion[];
  loading?: boolean;
  error?: string | null;
};

const TraitsStep: FunctionalComponent<TraitsStepProps> = ({
  value,
  onChange,
  questions,
  loading = false,
  error = null,
}) => {
  return (
    <div className="card-shell space-y-6" data-step="traits">
      <header className="space-y-2">
        <h2 className="type-title text-slate-900">Physiological traits</h2>
        <p className="text-slate-600">
          These questions help us tune the premium scoring so it respects how your body produces power,
          tolerance, and leverage.
        </p>
      </header>

      {loading ? (
        <div className="text-sm text-slate-600">Loading trait questions...</div>
      ) : null}

      {error ? (
        <div className="status status--error">
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="space-y-6">
          {questions.map((question) => (
            <fieldset key={question.field} className="space-y-3" aria-label={question.label}>
              <legend className="type-body flex items-center gap-2 font-semibold text-slate-800">
                {question.label}
                {question.description ? (
                  <InlineInfoTip
                    id={`${question.field}-tip`}
                    label={question.label}
                    steps={[question.description]}
                  />
                ) : null}
              </legend>
              <RadioCards
                name={question.field}
                value={value[question.field as keyof TraitAnswers] ?? undefined}
                options={question.options}
                columns={question.field === 'handedness' || question.field === 'footedness' ? 'grid-cols-1' : undefined}
                onChange={(nextValue) =>
                  onChange({
                    [question.field]: nextValue,
                  } as Partial<TraitAnswers>)
                }
              />
            </fieldset>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default TraitsStep;
