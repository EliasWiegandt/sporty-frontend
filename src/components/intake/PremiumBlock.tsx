import type { FunctionalComponent } from 'preact';

export type PremiumSectionKey = 'preferences' | 'goals' | 'injuries';

type PremiumBlockProps = {
  activeSection: PremiumSectionKey | null;
  visible: boolean;
};

const sectionMeta: Record<PremiumSectionKey, { title: string; description: string; buttonLabel: string }> = {
  preferences: {
    title: 'Preferences',
    description: 'Share the qualities you care about so we can weigh them when ranking matches.',
    buttonLabel: 'Add preference',
  },
  goals: {
    title: 'Goals',
    description: 'List your training or performance goals so we can bias matches toward them.',
    buttonLabel: 'Add goal',
  },
  injuries: {
    title: 'Injuries',
    description: 'Note lingering issues so we can flag risky sports or suggest safer variations.',
    buttonLabel: 'Add injury',
  },
};

const PremiumBlock: FunctionalComponent<PremiumBlockProps> = ({ activeSection, visible }) => {
  const isActive = (section: PremiumSectionKey) => activeSection === section;

  return (
    <section
      className="card-shell space-y-6"
      data-premium-block
      hidden={!visible}
    >
      <header className="space-y-2">
        <h2 className="type-title text-slate-900">Premium inputs</h2>
        <p className="text-slate-600">
          Apply a credit to capture preferences, goals, and injury context alongside your measurements.
        </p>
      </header>

      <div className="space-y-3">
        <div
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
          data-premium-locked
        >
          <p className="type-body font-semibold text-slate-800" data-premium-locked-message>
            Sign in and purchase a credit to unlock the premium inputs below.
          </p>
          <p className="text-slate-500">
            The toggle below shows whether a credit will be applied to this run.
          </p>
        </div>
        <div className="text-sm text-slate-500" data-premium-summary aria-live="polite" />
      </div>

      <label className="flex items-center gap-3" data-premium-toggle hidden>
        <input
          type="checkbox"
          data-premium-apply
          className="h-4 w-4 rounded border border-slate-300 text-teal-600 focus:ring-0"
        />
        <span className="text-sm font-semibold text-slate-800">Apply one adult analysis credit</span>
      </label>

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
                  <select className="input-field" data-field="preference_id">
                    <option value="">Select preference</option>
                  </select>
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
                  <select className="input-field" data-field="goal_id">
                    <option value="">Select goal</option>
                  </select>
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
                <label className="space-y-2">
                  <span className="type-body font-semibold text-slate-800">Injury</span>
                  <select className="input-field" data-field="injury_id">
                    <option value="">Select injury</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="type-body font-semibold text-slate-800">Area / subcategory</span>
                  <select className="input-field" data-field="injury_subcategory_id">
                    <option value="">General</option>
                  </select>
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
                <label className="space-y-2">
                  <span className="type-body font-semibold text-slate-800">Notes</span>
                  <input
                    type="text"
                    className="input-field"
                    data-field="notes"
                    placeholder="Optional detail"
                  />
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
