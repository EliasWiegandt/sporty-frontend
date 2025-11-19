export type PremiumControllerConfig = {
  block: HTMLElement | null;
  locked: HTMLElement | null;
  lockedMessage: HTMLElement | null;
  summary: HTMLElement | null;
  getClient: () => any;
};

import type { PreferenceInput, GoalInput, InjuryInput } from '../../data/intakeSchema';

export type PremiumSelectionData = {
  preferences: PreferenceInput[];
  goals: GoalInput[];
  injuries: InjuryInput[];
};

export type PremiumController = {
  update: (snapshot: { user: { id: string } | null; hasConsent: boolean }) => Promise<void>;
  collect: () => { applyCredit: boolean; data: PremiumSelectionData | null; errors: string[] };
  setConsent: (value: boolean) => void;
  reset: () => void;
};

type PriorityEntry = {
  node: HTMLElement;
  select: HTMLSelectElement | null;
  priority: HTMLSelectElement | null;
};
type InjuryEntry = {
  node: HTMLElement;
  injurySelect: HTMLSelectElement | null;
  subcategorySelect: HTMLSelectElement | null;
  severitySelect: HTMLSelectElement | null;
  notesInput: HTMLInputElement | null;
};

function createPriorityList(root: HTMLElement | null, config: { label: string; keyField: string; max: number }) {
  if (!root) {
    return {
      setOptions: (_options: any[]) => {},
      collect: () => ({ data: [], errors: [] as string[] }),
      reset: () => {},
      addEntry: () => {},
    };
  }

  const itemsContainer = root.querySelector('[data-items]');
  const template = root.querySelector<HTMLTemplateElement>('template[data-template]');
  const countEl = root.querySelector<HTMLElement>('[data-count]');
  const addBtn = root.querySelector<HTMLButtonElement>('[data-add]');

  if (!itemsContainer || !template) {
    return {
      setOptions: (_options: any[]) => {},
      collect: () => ({ data: [], errors: [] as string[] }),
      reset: () => {},
      addEntry: () => {},
    };
  }

  const state = {
    options: [] as Array<{ id: string; name?: string; description?: string }>,
    entries: [] as PriorityEntry[],
  };

  const updateUI = () => {
    const count = state.entries.length;
    if (countEl) countEl.textContent = `${count} / ${config.max}`;
    if (addBtn) addBtn.disabled = count >= config.max;
  };

  const hasCapacity = () => state.entries.length < config.max;

  const findAvailable = (current: PriorityEntry) => {
    const used = new Set(
      state.entries
        .filter((entry) => entry !== current)
        .map((entry) => entry.select?.value)
        .filter(Boolean)
    );
    const available = state.options.find((opt) => !used.has(opt.id));
    return available ? available.id : '';
  };

  const populateSelect = (entry: PriorityEntry, targetId?: string) => {
    const select = entry.select;
    if (!select) return;
    const current = targetId || select.value;
    const used = new Set(state.entries.map((item) => item.select?.value).filter(Boolean));
    select.innerHTML = '';
    state.options.forEach((option) => {
      const optionEl = document.createElement('option');
      optionEl.value = option.id;
      optionEl.textContent = option.name || option.id;
      if (option.description) optionEl.title = option.description;
      if (used.has(option.id) && option.id !== current) {
        optionEl.disabled = true;
      }
      select.appendChild(optionEl);
    });
    if (!state.options.length) {
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = `No ${config.label.toLowerCase()} options available`;
      placeholder.disabled = true;
      placeholder.selected = true;
      select.appendChild(placeholder);
    }
    const matches = state.options.some((opt) => opt.id === current);
    if (matches) select.value = current;
    else {
      const first = Array.from(select.options).find((opt) => !opt.disabled);
      select.value = first ? first.value : '';
    }
  };

  const addEntry = (defaultId?: string) => {
    if (!hasCapacity()) return;
    const clone = template.content.cloneNode(true) as DocumentFragment;
    const node = clone.querySelector<HTMLElement>('[data-item]');
    if (!node) return;
    const select = node.querySelector<HTMLSelectElement>(`[data-field="${config.keyField}"]`);
    const priority = node.querySelector<HTMLSelectElement>('[data-field="priority"]');
    const remove = node.querySelector('[data-remove]');
    if (remove) {
      remove.addEventListener('click', () => {
        node.remove();
        state.entries = state.entries.filter((entry) => entry.node !== node);
        refresh();
        updateUI();
      });
    }
    const entry = { node, select, priority };
    state.entries.push(entry);
    itemsContainer.appendChild(node);
    if (select) {
      select.addEventListener('change', () => refresh());
    }
    const id = defaultId || findAvailable(entry);
    populateSelect(entry, id);
    if (priority && !priority.value) priority.value = 'must_have';
    updateUI();
  };

  const refresh = () => {
    state.entries.forEach((entry) => populateSelect(entry, entry.select?.value));
  };

  return {
    setOptions(options: typeof state.options) {
      state.options = Array.isArray(options) ? [...options] : [];
      refresh();
      updateUI();
    },
    collect() {
      const data: Array<Record<string, unknown>> = [];
      const errors: string[] = [];
      const seen = new Set<string>();
      state.entries.forEach((entry) => {
        const value = entry.select?.value || '';
        if (!value) {
          errors.push(`Select a ${config.label.toLowerCase()} for each entry.`);
          return;
        }
        if (seen.has(value)) {
          errors.push(`Each ${config.label.toLowerCase()} can only be chosen once.`);
          return;
        }
        seen.add(value);
        const option = state.options.find((opt) => opt.id === value);
        data.push({
          [config.keyField]: value,
          priority: entry.priority?.value || 'nice_to_have',
          name: option?.name,
          description: option?.description,
        });
      });
      return { data, errors };
    },
    reset() {
      state.entries.forEach((entry) => entry.node.remove());
      state.entries = [];
      updateUI();
    },
    addEntry,
  };
}

const createInjuryList = (root: HTMLElement | null, config: { max: number }) => {
  if (!root) {
    return {
      setOptions: (_injuries: any[]) => {},
      collect: () => ({ data: [], errors: [] as string[] }),
      reset: () => {},
    };
  }

  const itemsContainer = root.querySelector('[data-items]');
  const template = root.querySelector<HTMLTemplateElement>('template[data-template]');
  const countEl = root.querySelector<HTMLElement>('[data-count]');
  const addBtn = root.querySelector<HTMLButtonElement>('[data-add]');

  if (!itemsContainer || !template) {
    return {
      setOptions: (_injuries: any[]) => {},
      collect: () => ({ data: [], errors: [] as string[] }),
      reset: () => {},
    };
  }

  const state = {
    injuries: [] as Array<{ id: string; name: string; description?: string }>,
    subcategories: {} as Record<string, Array<{ id: string; name: string; definition?: string }>>,
    entries: [] as InjuryEntry[],
  };

  const updateUI = () => {
    const count = state.entries.length;
    if (countEl) countEl.textContent = `${count} / ${config.max}`;
    if (addBtn) addBtn.disabled = count >= config.max || state.injuries.length === 0;
  };

  const populateOptions = (entry: InjuryEntry, targetId?: string) => {
    const select = entry.injurySelect;
    if (!select) return;
    const current = targetId || select.value;
    select.innerHTML = '';
    state.injuries.forEach((injury) => {
      const option = document.createElement('option');
      option.value = injury.id;
      option.textContent = injury.name;
      if (injury.description) option.title = injury.description;
      select.appendChild(option);
    });
    if (!state.injuries.length) {
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'No injuries available';
      placeholder.disabled = true;
      placeholder.selected = true;
      select.appendChild(placeholder);
    }
    const match = state.injuries.some((injury) => injury.id === current);
    select.value = match ? current : state.injuries[0]?.id || '';
    updateSubcategories(entry, true);
  };

  const updateSubcategories = (entry: InjuryEntry, preserveValue = false) => {
    const select = entry.subcategorySelect;
    if (!select) return;
    const injuryId = entry.injurySelect?.value || '';
    const subs = state.subcategories[injuryId] || [];
    const previous = preserveValue ? select.value : '';
    select.innerHTML = '';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'General';
    select.appendChild(defaultOpt);
    subs.forEach((sub) => {
      const option = document.createElement('option');
      option.value = sub.id;
      option.textContent = sub.name;
      if (sub.definition) option.title = sub.definition;
      select.appendChild(option);
    });
    if (previous && subs.some((sub) => sub.id === previous)) {
      select.value = previous;
    } else {
      select.value = '';
    }
  };

  const collect = () => {
    const data: Array<Record<string, unknown>> = [];
    const errors: string[] = [];
    const seen = new Set<string>();
    state.entries.forEach((entry) => {
      const injuryId = entry.injurySelect?.value || '';
      if (!injuryId) {
        errors.push('Select an injury for each entry.');
        return;
      }
      const key = entry.subcategorySelect?.value || injuryId;
      if (seen.has(key)) {
        errors.push('Each injury or specific area can only be listed once.');
        return;
      }
      seen.add(key);
      const severity = entry.severitySelect?.value || 'somewhat_bad';
      const notes = entry.notesInput?.value?.trim() || null;
      data.push({
        injury_id: injuryId,
        injury_subcategory_id: entry.subcategorySelect?.value || null,
        severity,
        notes,
      });
    });
    return { data, errors };
  };

  const addEntry = (defaults?: Record<string, string>) => {
    if (state.entries.length >= config.max) return;
    const clone = template.content.cloneNode(true) as DocumentFragment;
    const node = clone.querySelector<HTMLElement>('[data-item]');
    if (!node) return;
    const select = node.querySelector<HTMLSelectElement>('[data-field="injury_id"]');
    const subcategory = node.querySelector<HTMLSelectElement>('[data-field="injury_subcategory_id"]');
    const severity = node.querySelector<HTMLSelectElement>('[data-field="severity"]');
    const notes = node.querySelector<HTMLInputElement>('[data-field="notes"]');
    const remove = node.querySelector('[data-remove]');
    if (remove) {
      remove.addEventListener('click', () => {
        node.remove();
        state.entries = state.entries.filter((entry) => entry.node !== node);
        updateUI();
      });
    }
    const entry: InjuryEntry = {
      node,
      injurySelect: select,
      subcategorySelect: subcategory,
      severitySelect: severity,
      notesInput: notes,
    };
    state.entries.push(entry);
    itemsContainer.appendChild(node);
    if (select) {
      select.addEventListener('change', () => updateSubcategories(entry));
    }
    const targetInjury = defaults?.injury_id;
    populateOptions(entry, targetInjury);
    if (severity && !severity.value) severity.value = 'somewhat_bad';
    updateUI();
  };

  const reset = () => {
    state.entries.forEach((entry) => entry.node.remove());
    state.entries = [];
    updateUI();
  };

  return {
    setOptions(
      injuries: Array<{ id: string; name: string; description?: string }>,
      subcategories: Record<string, Array<{ id: string; name: string; definition?: string }>>
    ) {
      state.injuries = Array.isArray(injuries) ? [...injuries] : [];
      state.subcategories = subcategories || {};
      state.entries.forEach((entry) => populateOptions(entry));
      updateUI();
    },
    collect,
    reset,
    addEntry,
  };
};

async function fetchTaxonomy(client: any) {
  if (!client) return null;
  const [prefRes, goalRes, injuryRes, subRes] = await Promise.all([
    client.from('preferences_catalog').select('id, name, description').order('name', { ascending: true }),
    client.from('goals_catalog').select('id, name, description').order('name', { ascending: true }),
    client.from('injuries_catalog').select('id, name, description').order('name', { ascending: true }),
    client
      .from('injury_subcategories_catalog')
      .select('id, injury_id, name, definition, symptoms, causes, treatment')
      .order('name', { ascending: true }),
  ]);
  if (prefRes.error || goalRes.error || injuryRes.error || subRes.error) {
    throw prefRes.error || goalRes.error || injuryRes.error || subRes.error;
  }
  const injurySubcategories: Record<string, any[]> = {};
  (subRes.data || []).forEach((row: any) => {
    if (!injurySubcategories[row.injury_id]) injurySubcategories[row.injury_id] = [];
    injurySubcategories[row.injury_id].push(row);
  });
  return {
    preferences: prefRes.data || [],
    goals: goalRes.data || [],
    injuries: injuryRes.data || [],
    injurySubcategories,
  };
}

const toPreferenceInputs = (entries: Array<Record<string, unknown>>): PreferenceInput[] =>
  entries.map((entry) => ({
    preference_id: String(entry.preference_id),
    priority: entry.priority === 'must_have' ? 'must_have' : 'nice_to_have',
  }));

const toGoalInputs = (entries: Array<Record<string, unknown>>): GoalInput[] =>
  entries.map((entry) => ({
    goal_id: String(entry.goal_id),
    priority: entry.priority === 'must_have' ? 'must_have' : 'nice_to_have',
  }));

const toInjuryInputs = (entries: Array<Record<string, unknown>>): InjuryInput[] =>
  entries.map((entry) => {
    const severity = (entry.severity as InjuryInput['severity']) || 'somewhat_bad';
    return {
      injury_id: String(entry.injury_id),
      injury_subcategory_id: (entry.injury_subcategory_id as string | null) || null,
      severity,
      notes: (entry.notes as string | null) || null,
    };
  });

async function fetchAdultCredits(userId: string | null) {
  if (!userId) return { availableCount: 0 };
  const response = await fetch(`/api/credits?user_id=${encodeURIComponent(userId)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch credits (${response.status})`);
  }
  const payload = await response.json();
  return { availableCount: Number(payload.adult_credits) || 0 };
}

export function createPremiumController(config: PremiumControllerConfig): PremiumController {
  const { block, locked, lockedMessage, summary, getClient } = config;
  const preferenceRoot = block ? block.querySelector<HTMLElement>('[data-list="preferences"]') : null;
  const goalRoot = block ? block.querySelector<HTMLElement>('[data-list="goals"]') : null;
  const injuryRoot = block ? block.querySelector<HTMLElement>('[data-list="injuries"]') : null;
  const preferenceList = createPriorityList(preferenceRoot, { label: 'Preference', keyField: 'preference_id', max: 20 });
  const goalList = createPriorityList(goalRoot, { label: 'Goal', keyField: 'goal_id', max: 20 });
  const injuryList = createInjuryList(injuryRoot, { max: 20 });

  let active = false;
  let applyCredit = false;
  let consentGranted = false;
  let creditCount = 0;
  let lastUserId: string | null = null;
  let updateToken = 0;

  const toggleWrapper = block ? block.querySelector<HTMLElement>('[data-premium-toggle]') : null;
  const applyToggle = block ? block.querySelector<HTMLInputElement>('[data-premium-apply]') : null;

  if (applyToggle) {
    applyToggle.addEventListener('change', (event) => {
      applyCredit = Boolean((event.target as HTMLInputElement).checked);
      updateSummary();
    });
  }

  const updateSummary = () => {
    if (!summary) return;
    if (!active) {
      summary.textContent = '';
      return;
    }
    const creditText = creditCount === 1 ? '1 adult analysis credit available.' : `${creditCount} adult analysis credits available.`;
    const actionText = applyCredit
      ? 'We will apply one credit when you submit.'
      : 'Toggle below to apply a credit for the detailed analysis.';
    summary.textContent = consentGranted
      ? `${creditText} ${actionText}`
      : `${creditText} Enable data-retention consent when prompted so we can store these detailed inputs.`;
  };

  const activate = () => {
    active = true;
    if (locked) locked.hidden = true;
    if (block) block.hidden = false;
    if (toggleWrapper) toggleWrapper.hidden = false;
    if (applyToggle) applyToggle.disabled = false;
    updateSummary();
  };

  const deactivate = (message?: string) => {
    active = false;
    creditCount = 0;
    applyCredit = false;
    if (block) block.hidden = true;
    if (locked) locked.hidden = false;
    if (lockedMessage) lockedMessage.textContent = message || 'Premium credits let you capture preferences, goals, and injuries alongside your measurements. Sign in and apply a credit to unlock deeper tailoring.';
    if (toggleWrapper) toggleWrapper.hidden = true;
    if (applyToggle) {
      applyToggle.checked = false;
      applyToggle.disabled = true;
    }
    preferenceList.reset();
    goalList.reset();
    injuryList.reset();
  };

  return {
    async update(snapshot) {
      const client = getClient();
      const userId = snapshot.user ? snapshot.user.id : null;
      const token = ++updateToken;
      if (!block || !locked) return;
      if (!userId) {
        lastUserId = null;
        deactivate();
        return;
      }
      let credits;
      try {
        credits = await fetchAdultCredits(userId);
      } catch (error) {
        console.error('Failed to load premium credits', error);
        if (token === updateToken) {
          deactivate('Unable to confirm your premium credits right now. Please try again in a moment.');
        }
        return;
      }
      if (token !== updateToken) return;
      creditCount = credits.availableCount || 0;
      if (creditCount <= 0) {
        deactivate('Add an adult analysis credit to unlock detailed inputs.');
        return;
      }
      if (!client) {
        deactivate('Log in again to manage premium inputs.');
        return;
      }
      if (lastUserId !== userId) {
        applyCredit = false;
        if (applyToggle) applyToggle.checked = false;
      }
      lastUserId = userId;
      let taxonomy;
      try {
        taxonomy = await fetchTaxonomy(client);
      } catch (error) {
        console.error('Failed to load premium taxonomy', error);
        if (token === updateToken) {
          deactivate('We could not load premium input options. Refresh and try again.');
        }
        return;
      }
      if (!taxonomy) {
        deactivate('We could not load premium input options. Refresh and try again.');
        return;
      }
      if (token !== updateToken) return;
      preferenceList.setOptions(taxonomy.preferences);
      goalList.setOptions(taxonomy.goals);
      injuryList.setOptions(taxonomy.injuries, taxonomy.injurySubcategories);
      if (toggleWrapper) toggleWrapper.hidden = false;
      if (applyToggle) {
        applyToggle.disabled = false;
        applyToggle.checked = applyCredit;
      }
      activate();
    },
    collect() {
      if (!active) return { applyCredit: false, data: null, errors: [] };
      const pref = preferenceList.collect();
      const goals = goalList.collect();
      const injuries = injuryList.collect();
      const errors = [...pref.errors, ...goals.errors, ...injuries.errors];
      const preferences = toPreferenceInputs(pref.data);
      const goalListData = toGoalInputs(goals.data);
      const injuryListData = toInjuryInputs(injuries.data);
      const hasData = preferences.length || goalListData.length || injuryListData.length;
      return {
        applyCredit,
        data: hasData
          ? { preferences, goals: goalListData, injuries: injuryListData }
          : null,
        errors,
      };
    },
    setConsent(value) {
      consentGranted = Boolean(value);
      updateSummary();
    },
    reset() {
      deactivate();
    },
  };
}
