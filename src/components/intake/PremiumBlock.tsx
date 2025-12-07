import type { FunctionalComponent } from 'preact';

export type PremiumSectionKey = 'preferences' | 'goals' | 'injuries';

type PremiumBlockProps = {
  activeSection: PremiumSectionKey | null;
  visible: boolean;
};

const sectionMeta: Record<PremiumSectionKey, { title: string; description: string; buttonLabel: string }> = {
  preferences: {
    title: 'Preferences',
    description: 'Search and add the preferences that matter to you.',
    buttonLabel: 'Add preference',
  },
  goals: {
    title: 'Goals',
    description: 'Add training or performance goals to tilt matches toward them.',
    buttonLabel: 'Add goal',
  },
  injuries: {
    title: 'Injuries',
    description: 'Flag current or past injuries so we can account for risk.',
    buttonLabel: 'Add injury',
  },
};

const PremiumBlock: FunctionalComponent<PremiumBlockProps> = ({ activeSection, visible }) => {
  const isActive = (section: PremiumSectionKey) => activeSection === section;

  return (
    <section className="card-shell space-y-6" data-premium-block hidden={!visible}>
      <div className="space-y-3">
        <div
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
          data-premium-locked
        >
          <p className="type-body font-semibold text-slate-800" data-premium-locked-message>
            Sign in with a credit to add preferences, goals, and injuries.
          </p>
        </div>
        <div className="text-sm text-slate-500" data-premium-summary aria-live="polite" />
      </div>

      <section
        className="space-y-3"
        data-premium-section
        data-section="preferences"
        hidden={!isActive('preferences')}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="type-lead text-slate-800">{sectionMeta.preferences.title}</h3>
            <p className="text-sm text-slate-500">{sectionMeta.preferences.description}</p>
          </div>
          <span className="text-xs uppercase tracking-wide text-slate-400" data-count>
            0 / 20
          </span>
        </div>
        <div className="space-y-4" data-list="preferences">
          <div data-items className="space-y-4" />
          <div className="flex justify-end">
            <button data-add type="button" className="btn-pill btn-pill-secondary btn-pill-xs">
              {sectionMeta.preferences.buttonLabel}
            </button>
          </div>
          <template data-template>
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" data-item>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="type-body font-semibold text-slate-800">Preference</span>
                  <div className="relative" data-search-wrap>
                    <input
                      type="text"
                      className="input-field w-full"
                      placeholder="Search preferences…"
                      data-search-input
                    />
                    <input type="hidden" data-field="preference_id" />
                    <div
                      className="absolute inset-x-0 top-full z-20 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-lg hidden"
                      data-search-results
                    />
                  </div>
                </label>
                <label className="space-y-2">
                  <span className="type-body font-semibold text-slate-800">Priority</span>
                  <select className="input-field" data-field="priority">
                    <option value="must_have">Must have</option>
                    <option value="nice_to_have">Nice to have</option>
                  </select>
                </label>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="btn-pill btn-pill-secondary btn-pill-xs"
                  data-remove
                >
                  Remove
                </button>
              </div>
            </div>
          </template>
        </div>
      </section>

      <section
        className="space-y-3"
        data-premium-section
        data-section="goals"
        hidden={!isActive('goals')}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="type-lead text-slate-800">{sectionMeta.goals.title}</h3>
            <p className="text-sm text-slate-500">{sectionMeta.goals.description}</p>
          </div>
          <span className="text-xs uppercase tracking-wide text-slate-400" data-count>
            0 / 20
          </span>
        </div>
        <div className="space-y-4" data-list="goals">
          <div data-items className="space-y-4" />
          <div className="flex justify-end">
            <button data-add type="button" className="btn-pill btn-pill-secondary btn-pill-xs">
              {sectionMeta.goals.buttonLabel}
            </button>
          </div>
          <template data-template>
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" data-item>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="type-body font-semibold text-slate-800">Goal</span>
                  <div className="relative" data-search-wrap>
                    <input
                      type="text"
                      className="input-field w-full"
                      placeholder="Search goals…"
                      data-search-input
                    />
                    <input type="hidden" data-field="goal_id" />
                    <div
                      className="absolute inset-x-0 top-full z-20 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-lg hidden"
                      data-search-results
                    />
                  </div>
                </label>
                <label className="space-y-2">
                  <span className="type-body font-semibold text-slate-800">Priority</span>
                  <select className="input-field" data-field="priority">
                    <option value="must_have">Must have</option>
                    <option value="nice_to_have">Nice to have</option>
                  </select>
                </label>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="btn-pill btn-pill-secondary btn-pill-xs"
                  data-remove
                >
                  Remove
                </button>
              </div>
            </div>
          </template>
        </div>
      </section>

      <section
        className="space-y-3"
        data-premium-section
        data-section="injuries"
        hidden={!isActive('injuries')}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="type-lead text-slate-800">{sectionMeta.injuries.title}</h3>
            <p className="text-sm text-slate-500">{sectionMeta.injuries.description}</p>
          </div>
          <span className="text-xs uppercase tracking-wide text-slate-400" data-count>
            0 / 20
          </span>
        </div>
        <div className="space-y-4" data-list="injuries">
          <div data-items className="space-y-4" />
          <div className="flex justify-end">
            <button data-add type="button" className="btn-pill btn-pill-secondary btn-pill-xs">
              {sectionMeta.injuries.buttonLabel}
            </button>
          </div>
          <template data-template>
            <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" data-item>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 md:col-span-2">
                  <span className="type-body font-semibold text-slate-800">Injury or area</span>
                  <div className="relative" data-search-wrap>
                    <input
                      type="text"
                      className="input-field w-full"
                      placeholder="Search injury areas…"
                      data-search-input
                    />
                    <input type="hidden" data-field="injury_subcategory_id" />
                    <div
                      className="absolute inset-x-0 top-full z-20 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-lg hidden"
                      data-search-results
                    />
                  </div>
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="type-body font-semibold text-slate-800">Severity</span>
                  <select className="input-field" data-field="severity">
                    <option value="severe">Severe</option>
                    <option value="somewhat_bad">Somewhat bad</option>
                    <option value="mostly_healed">Mostly healed</option>
                  </select>
                </label>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="btn-pill btn-pill-secondary btn-pill-xs"
                  data-remove
                >
                  Remove
                </button>
              </div>
            </div>
          </template>
        </div>
      </section>
    </section>
  );
};

export default PremiumBlock;
