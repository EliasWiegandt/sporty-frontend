export type PremiumControllerConfig = {
  block: HTMLElement | null;
  locked: HTMLElement | null;
  lockedMessage: HTMLElement | null;
  summary: HTMLElement | null;
  getClient: () => any;
  creditType?: 'adult' | 'child';
  prefillForTesting?: boolean;
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
  searchInput: HTMLInputElement | null;
  hiddenId: HTMLInputElement | null;
  results: HTMLElement | null;
  priority: HTMLSelectElement | null;
  labelEl: HTMLElement | null;
};
type InjuryEntry = {
  node: HTMLElement;
  subcatSearch: HTMLInputElement | null;
  subcatResults: HTMLElement | null;
  injuryHidden: HTMLInputElement | null;
  subcatHidden: HTMLInputElement | null;
  severitySelect: HTMLSelectElement | null;
};

function createPriorityList(
  root: HTMLElement | null,
  config: {
    label: string;
    keyField: string;
    max: number;
    priorityField?: string;
    priorityOptions?: Array<{ value: string; label: string }>;
    defaultPriority?: string;
    parentField?: string;
  }
) {
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
    options: [] as Array<{ id: string; name?: string; description?: string; searchText?: string; parentId?: string }>,
    entries: [] as PriorityEntry[],
  };

  const updateUI = () => {
    const count = state.entries.length;
    if (countEl) countEl.textContent = `${count} / ${config.max}`;
    if (addBtn) addBtn.disabled = count >= config.max;
  };

  if (addBtn) {
    addBtn.addEventListener('click', () => addEntry());
  }

  const hasCapacity = () => state.entries.length < config.max;

  const findAvailable = (current: PriorityEntry) => {
    const used = new Set(
      state.entries
        .filter((entry) => entry !== current)
        .map((entry) => entry.hiddenId?.value)
        .filter(Boolean)
    );
    const available = state.options.find((opt) => !used.has(opt.id));
    return available ? available.id : '';
  };

  const renderResults = (entry: PriorityEntry, query: string) => {
    if (!entry.results) return;
    const q = query.trim().toLowerCase();
    const candidates = state.options.map((opt) => {
      const name = opt.name || opt.id;
      const desc = opt.description || '';
      const inName = name.toLowerCase().includes(q);
      const inDesc = desc.toLowerCase().includes(q);
      const score = (inName ? 2 : 0) + (inDesc ? 1 : 0);
      return { opt, score };
    }).filter(({ score }) => q === '' ? true : score > 0)
      .sort((a, b) => b.score - a.score || (a.opt.name || '').localeCompare(b.opt.name || ''))
      .slice(0, 20);

    entry.results.innerHTML = '';
    if (!candidates.length) {
      entry.results.innerHTML = '<div class="px-4 py-2 text-sm text-slate-500">No matches found</div>';
      entry.results.classList.remove('hidden');
      return;
    }
    candidates.forEach(({ opt, score }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'w-full px-4 py-2 text-left text-sm hover:bg-slate-50';
      const name = opt.name || opt.id;
      const desc = opt.description || '';
      const preview = desc.length > 110 ? `${desc.slice(0, 110)}…` : desc;
      btn.innerHTML = `<div class="font-semibold text-slate-800">${name}</div><div class="text-xs text-slate-500">${preview}</div>`;
      btn.addEventListener('click', () => {
        if (entry.searchInput) entry.searchInput.value = name;
        if (entry.hiddenId) entry.hiddenId.value = opt.id;
        entry.results?.classList.add('hidden');
        updateUI();
      });
      entry.results?.appendChild(btn);
    });
    entry.results.classList.remove('hidden');
  };

  const wireSearch = (entry: PriorityEntry, defaultId?: string) => {
    const picked = state.options.find((o) => o.id === defaultId);
    if (entry.hiddenId) entry.hiddenId.value = defaultId || '';
    if (entry.searchInput && picked) entry.searchInput.value = picked.name || picked.id;

    const closeResults = () => entry.results?.classList.add('hidden');
    entry.searchInput?.addEventListener('focus', () => {
      renderResults(entry, entry.searchInput?.value || '');
    });
    entry.searchInput?.addEventListener('input', (e) => {
      const value = (e.target as HTMLInputElement).value;
      // clear hidden id when typing free text
      if (entry.hiddenId) entry.hiddenId.value = '';
      renderResults(entry, value);
    });
    document.addEventListener('click', (evt) => {
      if (entry.results && !entry.results.contains(evt.target as Node) && !entry.searchInput?.contains(evt.target as Node)) {
        closeResults();
      }
    });
  };

  const addEntry = (defaultId?: string) => {
    if (!hasCapacity()) return;
    const clone = template.content.cloneNode(true) as DocumentFragment;
    const node = clone.querySelector<HTMLElement>('[data-item]');
    if (!node) return;
    const searchInput = node.querySelector<HTMLInputElement>('[data-search-input]');
    const hiddenId = node.querySelector<HTMLInputElement>(`[data-field="${config.keyField}"]`);
    const results = node.querySelector<HTMLElement>('[data-search-results]');
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
    const entry = { node, searchInput, hiddenId, results, priority, labelEl: null };
    state.entries.push(entry);
    itemsContainer.appendChild(node);
    wireSearch(entry, defaultId);
    if (priority && !priority.value) priority.value = config.defaultPriority || 'must_have';
    updateUI();
  };

  const refresh = () => {
    state.entries.forEach((entry) => {
      const currentId = entry.hiddenId?.value;
      const picked = state.options.find((o) => o.id === currentId);
      if (entry.searchInput && picked) entry.searchInput.value = picked.name || picked.id;
    });
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
        const value = entry.hiddenId?.value || '';
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
          [config.priorityField || 'priority']: entry.priority?.value || config.defaultPriority || 'nice_to_have',
          ...(config.parentField && option?.parentId ? { [config.parentField]: option.parentId } : {}),
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
      setOptions: (_injuries: any[], _subs: any) => {},
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
      setOptions: (_injuries: any[], _subs: any) => {},
      collect: () => ({ data: [], errors: [] as string[] }),
      reset: () => {},
      addEntry: () => {},
    };
  }

  const state = {
    subcats: [] as Array<{ id: string; injury_id: string; name: string; description?: string }>,
    entries: [] as InjuryEntry[],
  };

  const updateUI = () => {
    const count = state.entries.length;
    if (countEl) countEl.textContent = `${count} / ${config.max}`;
    if (addBtn) addBtn.disabled = count >= config.max || state.subcats.length === 0;
  };

  if (addBtn) {
    addBtn.addEventListener('click', () => addEntry());
  }

  const renderOptions = (
    query: string,
    resultsEl: HTMLElement | null,
    onPick: (item: { id: string; injury_id: string; name: string }) => void
  ) => {
    if (!resultsEl) return;
    const q = query.trim().toLowerCase();
    const candidates = state.subcats
      .map((opt) => {
        const name = opt.name;
        const desc = opt.description || '';
        const inName = name.toLowerCase().includes(q);
        const inDesc = desc.toLowerCase().includes(q);
        const score = (inName ? 2 : 0) + (inDesc ? 1 : 0);
        return { opt, score, preview: desc.length > 110 ? `${desc.slice(0, 110)}…` : desc };
      })
      .filter(({ score }) => (q === '' ? true : score > 0))
      .sort((a, b) => b.score - a.score || a.opt.name.localeCompare(b.opt.name))
      .slice(0, 20);
    resultsEl.innerHTML = '';
    if (!candidates.length) {
      resultsEl.innerHTML = '<div class="px-4 py-2 text-sm text-slate-500">No matches found</div>';
      resultsEl.classList.remove('hidden');
      return;
    }
    candidates.forEach(({ opt, preview }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'w-full px-4 py-2 text-left text-sm hover:bg-slate-50';
      btn.innerHTML = `<div class="font-semibold text-slate-800">${opt.name}</div><div class="text-xs text-slate-500">${preview}</div>`;
      btn.addEventListener('click', () => onPick({ id: opt.id, injury_id: opt.injury_id, name: opt.name }));
      resultsEl.appendChild(btn);
    });
    resultsEl.classList.remove('hidden');
  };

  const wireSearch = (
    entry: InjuryEntry,
    defaults?: { injury_id?: string; injury_subcategory_id?: string }
  ) => {
    const setSubcat = (subId?: string) => {
      const picked = state.subcats.find((s) => s.id === subId) || null;
      if (entry.subcatHidden) entry.subcatHidden.value = picked?.id || '';
      if (entry.injuryHidden) entry.injuryHidden.value = picked?.injury_id || '';
      if (entry.subcatSearch) entry.subcatSearch.value = picked?.name || '';
    };

    const initial = defaults?.injury_subcategory_id;
    if (initial) setSubcat(initial);

    entry.subcatSearch?.addEventListener('focus', () => {
      renderOptions(entry.subcatSearch?.value || '', entry.subcatResults, (item) => {
        setSubcat(item.id);
        entry.subcatResults?.classList.add('hidden');
      });
    });
    entry.subcatSearch?.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      if (entry.subcatHidden) entry.subcatHidden.value = '';
      if (entry.injuryHidden) entry.injuryHidden.value = '';
      renderOptions(val, entry.subcatResults, (item) => {
        setSubcat(item.id);
        entry.subcatResults?.classList.add('hidden');
      });
    });
  };

  const addEntry = (defaults?: Record<string, string>) => {
    if (state.entries.length >= config.max) return;
    const clone = template.content.cloneNode(true) as DocumentFragment;
    const node = clone.querySelector<HTMLElement>('[data-item]');
    if (!node) return;
    const subcatSearch = node.querySelector<HTMLInputElement>('[data-search-input-subcat]');
    const subcatResults = node.querySelector<HTMLElement>('[data-search-results-subcat]');
    const injuryHidden = node.querySelector<HTMLInputElement>('[data-field="injury_id"]');
    const subcatHidden = node.querySelector<HTMLInputElement>('[data-field="injury_subcategory_id"]');
    const severity = node.querySelector<HTMLSelectElement>('[data-field="severity"]');
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
      subcatSearch,
      subcatResults,
      injuryHidden,
      subcatHidden,
      severitySelect: severity,
    };
    state.entries.push(entry);
    itemsContainer.appendChild(node);
    if (severity && !severity.value) severity.value = 'somewhat_bad';
    wireSearch(entry, defaults);
    updateUI();
  };

  const reset = () => {
    state.entries.forEach((entry) => entry.node.remove());
    state.entries = [];
    updateUI();
  };

  return {
    setOptions(
      _injuries: Array<{ id: string; name: string; description?: string }>,
      subcategories: Record<string, Array<{ id: string; name: string; definition?: string; injury_id?: string }>>
    ) {
      const flat: Array<{ id: string; injury_id: string; name: string; description?: string }> = [];
      Object.entries(subcategories || {}).forEach(([injuryId, subs]) => {
        subs.forEach((sub) => {
          flat.push({
            id: sub.id,
            injury_id: injuryId,
            name: sub.name,
            description: sub.definition,
          });
        });
      });
      state.subcats = flat;
      updateUI();
    },
    collect() {
      const data: Array<Record<string, unknown>> = [];
      const errors: string[] = [];
      const seen = new Set<string>();
      state.entries.forEach((entry) => {
        const injuryId = entry.injuryHidden?.value || '';
        const subcatId = entry.subcatHidden?.value || '';
        if (!subcatId) {
          errors.push('Select an injury area for each entry.');
          return;
        }
        if (seen.has(subcatId)) {
          errors.push('Each injury area can only be listed once.');
          return;
        }
        seen.add(subcatId);
      const severity = entry.severitySelect?.value || 'somewhat_bad';
      data.push({
        injury_id: injuryId || null,
        injury_subcategory_id: subcatId,
        severity,
      });
    });
      return { data, errors };
    },
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
  entries
    .map((entry) => {
      const injuryId = entry.injury_id ? String(entry.injury_id) : '';
      const injurySub = entry.injury_subcategory_id ? String(entry.injury_subcategory_id) : null;
      const severity = (entry.severity as InjuryInput['severity']) || 'somewhat_bad';
      return {
        injury_id: injuryId,
        injury_subcategory_id: injurySub,
        severity,
        notes: null,
      };
    })
    .filter((entry) => Boolean(entry.injury_id));

async function fetchCredits(userId: string | null, creditType: 'adult' | 'child') {
  if (!userId) return { availableCount: 0 };
  const response = await fetch(`/api/credits?user_id=${encodeURIComponent(userId)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch credits (${response.status})`);
  }
  const payload = await response.json();
  const key = creditType === 'child' ? 'child_credits' : 'adult_credits';
  return { availableCount: Number(payload[key]) || 0 };
}

export function createPremiumController(config: PremiumControllerConfig): PremiumController {
  const { block, locked, lockedMessage, summary, getClient } = config;
  const creditType: 'adult' | 'child' = config.creditType || 'adult';
  const prefillForTesting = typeof config.prefillForTesting === 'boolean' ? config.prefillForTesting : true;
  const preferenceRoot = block ? block.querySelector<HTMLElement>('[data-list="preferences"]') : null;
  const goalRoot = block ? block.querySelector<HTMLElement>('[data-list="goals"]') : null;
  const injuryRoot = block ? block.querySelector<HTMLElement>('[data-list="injuries"]') : null;
  const preferenceList = createPriorityList(preferenceRoot, { label: 'Preference', keyField: 'preference_id', max: 20 });
  const goalList = createPriorityList(goalRoot, { label: 'Goal', keyField: 'goal_id', max: 20 });
  const injuryList = createPriorityList(injuryRoot, {
    label: 'Injury area',
    keyField: 'injury_subcategory_id',
    max: 20,
    priorityField: 'severity',
    defaultPriority: 'somewhat_bad',
    priorityOptions: [
      { value: 'severe', label: 'Severe' },
      { value: 'somewhat_bad', label: 'Somewhat bad' },
      { value: 'mostly_healed', label: 'Mostly healed' },
    ],
    parentField: 'injury_id',
  });

  let active = false;
  let applyCredit = false;
  let consentGranted = false;
  let creditCount = 0;
  let lastUserId: string | null = null;
  let updateToken = 0;

  const toggleWrapper = null;
  const applyToggle = null;

  const updateSummary = () => {
    if (!summary) return;
    if (!active) {
      summary.textContent = '';
      return;
    }
    summary.textContent = '';
  };

  const activate = () => {
    active = true;
    if (locked) locked.hidden = true;
    if (block) block.hidden = false;
    updateSummary();
  };

  const deactivate = (message?: string) => {
    active = false;
    creditCount = 0;
    applyCredit = false;
    if (block) block.hidden = true;
    if (locked) locked.hidden = false;
    if (lockedMessage) lockedMessage.textContent = message || 'Premium credits let you capture preferences, goals, and injuries alongside your measurements. Sign in and apply a credit to unlock deeper tailoring.';
    // toggle/checkbox removed
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
        credits = await fetchCredits(userId, creditType);
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
        deactivate(`Add a ${creditType} analysis credit to unlock detailed inputs.`);
        return;
      }
      if (!client) {
        deactivate('Log in again to manage premium inputs.');
        return;
      }
      if (lastUserId !== userId) {
        applyCredit = false;
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
      const flatSubcats = Object.entries(taxonomy.injurySubcategories || {}).flatMap(([injuryId, subs]) =>
        (subs || []).map((sub: any) => ({
          id: sub.id,
          name: sub.name,
          description: sub.definition,
          parentId: injuryId,
        }))
      );
      injuryList.setOptions(flatSubcats);
      if (prefillForTesting) {
        // Prefill a couple of entries for faster local testing.
        if ((injuryList as any).addEntry) {
          (injuryList as any).addEntry(flatSubcats[0]?.id);
          (injuryList as any).addEntry(flatSubcats[1]?.id);
        }
        if ((preferenceList as any).addEntry) {
          const first = taxonomy.preferences[0]?.id;
          const second = taxonomy.preferences[1]?.id;
          (preferenceList as any).addEntry(first);
          (preferenceList as any).addEntry(second);
        }
        if ((goalList as any).addEntry) {
          const first = taxonomy.goals[0]?.id;
          const second = taxonomy.goals[1]?.id;
          (goalList as any).addEntry(first);
          (goalList as any).addEntry(second);
        }
      }
      // Since we have confirmed credits > 0, auto-apply a credit
      applyCredit = true;
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
