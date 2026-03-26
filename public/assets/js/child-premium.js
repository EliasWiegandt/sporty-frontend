(function () {
  const form = document.querySelector('[data-child-premium-form]');
  const emptyState = document.querySelector('[data-premium-empty]');
  const summaryCard = document.querySelector('[data-premium-summary]');
  const summaryCopy = document.querySelector('[data-premium-copy]');
  const measurementSummaryEl = document.querySelector('[data-measurement-summary]');
  if (!form || !emptyState || !summaryCard) return;

  const sportyApp = window.SportyApp;
  const statusEl = form.querySelector('[data-status]');
  const submitBtn = form.querySelector('[data-submit]');
  const applyToggle = form.querySelector('[data-child-premium-apply]');
  const preferencesRoot = form.querySelector('[data-child-preferences]');
  const goalsRoot = form.querySelector('[data-child-goals]');
  const injuriesRoot = form.querySelector('[data-child-injuries]');
  const pastRoot = form.querySelector('[data-child-past]');

  const rawForecast = sessionStorage.getItem('sporty:lastChildForecast');
  const rawRequest = sessionStorage.getItem('sporty:lastChildForecastRequest');

  let forecast = null;
  let baseRequest = null;
  try {
    forecast = rawForecast ? JSON.parse(rawForecast) : null;
    baseRequest = rawRequest ? JSON.parse(rawRequest) : null;
  } catch (error) {
    console.warn('Failed to parse stored forecast/request', error);
  }

  if (!forecast || !baseRequest) {
    emptyState.hidden = false;
    form.hidden = true;
    summaryCard.hidden = true;
    return;
  }

  summaryCard.hidden = false;
  emptyState.hidden = true;

  const measurementEntries = extractMeasurementSummary(forecast);
  renderMeasurements(measurementEntries);

  const preferenceList = createPriorityList({
    root: preferencesRoot,
    type: 'preference',
  });
  const goalList = createPriorityList({
    root: goalsRoot,
    type: 'goal',
  });
  const injuryList = createInjuryList({
    root: injuriesRoot,
  });
  const pastController = createChildPastSportsController({
    root: pastRoot,
  });

  if (sportyApp && sportyApp.ready) {
    sportyApp.ready.then(() => {
      const client = sportyApp.getClient ? sportyApp.getClient() : null;
      const user = sportyApp.getUser ? sportyApp.getUser() : null;
      if (!baseRequest.guardian_user_id && user && user.id) {
        baseRequest.guardian_user_id = user.id;
      }
      if (client) {
        loadTaxonomy(client);
        pastController.setClient(client);
      }
      sportyApp.onAuthChange?.((snapshot) => {
        const current = snapshot && snapshot.user ? snapshot.user.id : null;
        if (!baseRequest.guardian_user_id && current) {
          baseRequest.guardian_user_id = current;
        }
      });
    });
  }

  prefillFromRequest(baseRequest);

  form.hidden = false;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!submitBtn) return;

    const preferenceSelection = preferenceList.collect();
    const goalSelection = goalList.collect();
    const injurySelection = injuryList.collect();
    const pastSelection = pastController.collect();

    const errors = [
      ...preferenceSelection.errors,
      ...goalSelection.errors,
      ...injurySelection.errors,
      ...pastSelection.errors,
    ];

    if (errors.length) {
      setStatus(errors.join(' '), 'error');
      return;
    }

    const applyCredit = applyToggle ? applyToggle.checked : true;
    if (!applyCredit) {
      setStatus('Apply a child credit to unlock premium sport matches.', 'error');
      return;
    }
    if (!baseRequest.guardian_user_id) {
      setStatus('Sign in as a guardian before applying a child credit.', 'error');
      return;
    }

    const payload = JSON.parse(JSON.stringify(baseRequest));
    payload.premium = {
      apply_credit: applyCredit,
      preferences: preferenceSelection.data,
      goals: goalSelection.data,
      injuries: injurySelection.data,
    };
    payload.past_sports = pastSelection.data;

    submitBtn.disabled = true;
    submitBtn.textContent = applyCredit ? 'Applying credit…' : 'Submitting…';
    setStatus(applyCredit ? 'Applying credit and scoring premium matches…' : 'Scoring premium matches…', 'info');

    try {
      const response = await fetch('/api/forecast-child', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const bodyText = await response.text();
      let resultJson = null;
      try {
        resultJson = JSON.parse(bodyText);
      } catch (error) {
        console.warn('Unable to parse premium response JSON', error);
      }

      if (!response.ok) {
        let detail = 'Unable to generate premium matches right now.';
        try {
          const json = resultJson || JSON.parse(bodyText);
          detail = json.detail || detail;
        } catch (_) {}
        throw new Error(detail);
      }

      if (resultJson && resultJson.premium_analysis && resultJson.premium_analysis.credit) {
        try {
          sessionStorage.setItem(
            'sporty:lastCreditSnapshot',
            JSON.stringify(resultJson.premium_analysis.credit.totals || {})
          );
        } catch (error) {
          console.warn('Unable to store credit snapshot', error);
        }
      }

      try {
        const runId = resultJson && resultJson.run_id ? String(resultJson.run_id) : '';
        if (!runId) {
          throw new Error('Missing child run id in premium response.');
        }
        sessionStorage.setItem('sporty:childResultsTab', 'matches');
        window.location.assign(`/child-results?id=${encodeURIComponent(runId)}&tab=matches`);
        return;
      } catch (_) {}
      throw new Error('Child analysis completed, but no run id was returned.');
    } catch (error) {
      console.error('Child premium analysis failed', error);
      setStatus(error.message || 'Unexpected error, please try again.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Get sport matches';
    }
  });

  function setStatus(message, type = 'info') {
    if (!statusEl) return;
    statusEl.innerHTML = message
      ? `<div class="status status--${type}">${message}</div>`
      : '';
  }

  function renderMeasurements(entries) {
    if (!measurementSummaryEl) return;
    measurementSummaryEl.innerHTML = '';
    entries.forEach((entry) => {
      const card = document.createElement('div');
      card.className = 'metric';
      const label = document.createElement('span');
      label.className = 'metric__label';
      label.textContent = entry.label;
      const value = document.createElement('span');
      value.className = 'metric__value';
      value.textContent = entry.value;
      card.appendChild(label);
      card.appendChild(value);
      measurementSummaryEl.appendChild(card);
    });
    if (summaryCopy) {
      summaryCopy.textContent = `Forecast weighted by ${forecast.weight_scenario?.replace(/_/g, ' ') || 'child data'} — refine premium signals below.`;
    }
  }

  function extractMeasurementSummary(res) {
    const results = res && res.results ? res.results : {};
    const keys = [
      ['height_cm', 'Height', 'cm'],
      ['weight_kg', 'Weight', 'kg'],
      ['arm_span_cm', 'Arm span', 'cm'],
      ['leg_inseam_cm', 'Leg inseam', 'cm'],
      ['shoulder_width_cm', 'Shoulder width', 'cm'],
      ['pelvic_bone_width_cm', 'Pelvic bone width', 'cm'],
      ['hand_length_cm', 'Hand length', 'cm'],
      ['foot_length_cm', 'Foot length', 'cm'],
    ];
    return keys.map(([field, label]) => {
      const entry = results[field] || {};
      const value = entry.forecast_value ?? entry.input_value ?? entry.cohort_average ?? null;
      return {
        label,
        value:
          value === null || value === undefined
            ? '—'
            : `${Number(value).toFixed(1)} ${field === 'weight_kg' ? 'kg' : 'cm'}`,
      };
    });
  }

  async function loadTaxonomy(client) {
    try {
      const [taxonomy, intakeCatalog] = await Promise.all([
        fetchChildTaxonomy(client),
        fetch('/api/intake-catalog', { headers: { Accept: 'application/json' } }).then(async (response) => {
          if (!response.ok) {
            throw new Error(`Failed to load intake catalog (${response.status})`);
          }
          return response.json();
        }),
      ]);
      preferenceList.setPriorityOptions(
        (((intakeCatalog || {}).preferences || {}).priority_options || []).map((option) => ({
          value: option.id,
          label: option.label,
        })),
        (((intakeCatalog || {}).preferences || {}).default_priority) || 'nice_to_have'
      );
      preferenceList.setOptions(taxonomy.preferences || []);
      goalList.setPriorityOptions(
        (((intakeCatalog || {}).goals || {}).priority_options || []).map((option) => ({
          value: option.id,
          label: option.label,
        })),
        (((intakeCatalog || {}).goals || {}).default_priority) || 'nice_to_have'
      );
      goalList.setOptions(taxonomy.goals || []);
      injuryList.setSeverityOptions(
        ((((intakeCatalog || {}).injuries || {}).severity_options) || []).map((option) => ({
          value: option.id,
          label: option.label,
        })),
        (((intakeCatalog || {}).injuries || {}).default_severity) || ''
      );
      injuryList.setOptions(
        (((intakeCatalog || {}).injuries || {}).options) || taxonomy.injuries || [],
        ((((intakeCatalog || {}).injuries || {}).subcategories) || []).reduce((acc, row) => {
          if (!row || !row.injury_id) return acc;
          const list = acc[row.injury_id] || [];
          list.push(row);
          acc[row.injury_id] = list;
          return acc;
        }, taxonomy.injurySubcategories || {})
      );
      pastController.setPolicy(((intakeCatalog || {}).past_sports) || {});
    } catch (error) {
      console.error('Failed to load premium taxonomy', error);
      setStatus('Unable to load premium options right now.', 'error');
    }
  }

  function prefillFromRequest(request) {
    if (!request) return;
    const premium = request.premium || {};
    const prefs = premium.preferences || [];
    const goals = premium.goals || [];
    const injuries = premium.injuries || [];
    const pastSports = request.past_sports || [];

    preferenceList.prefill(prefs);
    goalList.prefill(goals);
    injuryList.prefill(injuries);
    pastController.prefill(pastSports);

    if (applyToggle && typeof premium.apply_credit === 'boolean') {
      applyToggle.checked = premium.apply_credit;
    }
  }

  function createPriorityList(config) {
    const root = config.root;
    if (!root) {
      return {
        setOptions: () => {},
        setSeverityOptions: () => {},
        collect: () => ({ data: [], errors: [] }),
        prefill: () => {},
      };
    }
    const listRoot = root.querySelector(config.type === 'goal' ? '[data-goal-list]' : '[data-preference-list]');
    const countEl = root.querySelector(config.type === 'goal' ? '[data-goal-count]' : '[data-preference-count]');
    const addButton = root.querySelector(config.type === 'goal' ? '[data-add-goal]' : '[data-add-preference]');
    const template = root.querySelector(config.type === 'goal' ? 'template[data-goal-template]' : 'template[data-preference-template]');

    const state = {
      options: [],
      entries: [],
      priorityOptions: [],
      defaultPriority: 'nice_to_have',
    };

    if (addButton) {
      addButton.addEventListener('click', () => {
        addEntry();
      });
    }

    function setOptions(options) {
      state.options = Array.isArray(options) ? options.slice() : [];
      state.options.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      state.entries.forEach((entry) => populateOptions(entry));
    }

    function setPriorityOptions(options, defaultPriority) {
      state.priorityOptions = Array.isArray(options) ? options.slice() : [];
      state.defaultPriority = defaultPriority || 'nice_to_have';
      state.entries.forEach((entry) => populatePriorityOptions(entry));
    }

    function populateOptions(entry) {
      const select = entry.select;
      if (!select) return;
      select.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Select option';
      select.appendChild(placeholder);
      state.options.forEach((option) => {
        const opt = document.createElement('option');
        opt.value = option.id;
        opt.textContent = option.name || option.id;
        if (option.description) opt.title = option.description;
        select.appendChild(opt);
      });
      if (entry.value) {
        select.value = entry.value;
      }
    }

    function populatePriorityOptions(entry) {
      const select = entry.priority;
      if (!select || !state.priorityOptions.length) return;
      const currentValue = select.value;
      select.innerHTML = '';
      state.priorityOptions.forEach((option) => {
        const opt = document.createElement('option');
        opt.value = option.value;
        opt.textContent = option.label;
        select.appendChild(opt);
      });
      select.value = currentValue || state.defaultPriority || state.priorityOptions[0].value;
    }

    function addEntry(initial) {
      if (!template || !listRoot) return;
      const fragment = template.content.cloneNode(true);
      const item = fragment.querySelector('[data-item]');
      if (!item) return;
      const select = item.querySelector('select[data-field="preference_id"], select[data-field="goal_id"]');
      const priority = item.querySelector('select[data-field="priority"]');
      const removeBtn = item.querySelector('[data-remove]');

      const entry = { node: item, select, priority, value: initial ? initial.preference_id || initial.goal_id : '' };
      state.entries.push(entry);
      if (removeBtn) {
        removeBtn.addEventListener('click', () => removeEntry(entry));
      }

      populateOptions(entry);
      populatePriorityOptions(entry);
      if (priority && initial && initial.priority) {
        priority.value = initial.priority;
      }

      listRoot.appendChild(item);
      updateCount();
    }

    function removeEntry(entry) {
      const index = state.entries.indexOf(entry);
      if (index >= 0) state.entries.splice(index, 1);
      if (entry.node && entry.node.parentNode) {
        entry.node.parentNode.removeChild(entry.node);
      }
      updateCount();
    }

    function collect() {
      const errors = [];
      const data = [];
      state.entries.forEach((entry, index) => {
        const id = entry.select ? entry.select.value : '';
        if (!id) {
          errors.push(`${config.type === 'goal' ? 'Goal' : 'Preference'} ${index + 1}: choose an option.`);
          return;
        }
        data.push({
          [`${config.type}_id`]: id,
          priority: entry.priority ? entry.priority.value : state.defaultPriority,
          name: getOptionName(id),
        });
      });
      return { data, errors };
    }

    function getOptionName(id) {
      const option = state.options.find((opt) => opt.id === id);
      return option ? option.name : id;
    }

    function prefill(items) {
      if (!Array.isArray(items) || !items.length) return;
      items.forEach((item) => addEntry(item));
      updateCount();
    }

    function updateCount() {
      if (countEl) countEl.textContent = `${state.entries.length} / 10`;
      if (addButton) addButton.disabled = state.entries.length >= 10;
    }

    return {
      setOptions,
      setPriorityOptions,
      collect,
      prefill,
    };
  }

  function createInjuryList(config) {
    const root = config.root;
    if (!root) {
      return {
        setOptions: () => {},
        collect: () => ({ data: [], errors: [] }),
        prefill: () => {},
      };
    }
    const listRoot = root.querySelector('[data-injury-list]');
    const countEl = root.querySelector('[data-injury-count]');
    const addButton = root.querySelector('[data-add-injury]');
    const template = root.querySelector('template[data-injury-template]');

    const state = {
      injuries: [],
      subcategories: {},
      entries: [],
      severityOptions: [],
      defaultSeverity: '',
    };

    if (addButton) {
      addButton.addEventListener('click', () => addEntry());
    }

    function setOptions(injuries, subcategories) {
      state.injuries = Array.isArray(injuries) ? injuries.slice() : [];
      state.subcategories = subcategories || {};
      state.entries.forEach((entry) => {
        populateInjury(entry);
        populateSubcategories(entry);
      });
    }

    function setSeverityOptions(options, defaultSeverity) {
      state.severityOptions = Array.isArray(options) ? options.slice() : [];
      state.defaultSeverity = defaultSeverity || '';
      state.entries.forEach((entry) => renderSeverityOptions(entry.severitySelect));
    }

    function renderSeverityOptions(select) {
      if (!select || !state.severityOptions.length) return;
      const current = select.value;
      select.innerHTML = '';
      state.severityOptions.forEach((option) => {
        const el = document.createElement('option');
        el.value = option.value;
        el.textContent = option.label;
        select.appendChild(el);
      });
      select.value = current || state.defaultSeverity || state.severityOptions[0].value;
    }

    function addEntry(initial) {
      if (!template || !listRoot) return;
      const fragment = template.content.cloneNode(true);
      const item = fragment.querySelector('[data-item]');
      if (!item) return;
      const injurySelect = item.querySelector('select[data-field="injury_id"]');
      const subSelect = item.querySelector('select[data-field="injury_subcategory_id"]');
      const severitySelect = item.querySelector('select[data-field="severity"]');
      const notesInput = item.querySelector('input[data-field="notes"]');
      const removeBtn = item.querySelector('[data-remove]');

      const entry = {
        node: item,
        injurySelect,
        subSelect,
        severitySelect,
        notesInput,
        values: initial || {},
      };
      state.entries.push(entry);

      populateInjury(entry);
      populateSubcategories(entry, true);
      renderSeverityOptions(severitySelect);

      if (severitySelect && initial && initial.severity) {
        severitySelect.value = initial.severity;
      }
      if (notesInput && initial && initial.notes) {
        notesInput.value = initial.notes;
      }

      if (injurySelect) {
        injurySelect.addEventListener('change', () => populateSubcategories(entry));
      }

      if (removeBtn) {
        removeBtn.addEventListener('click', () => removeEntry(entry));
      }

      listRoot.appendChild(item);
      updateCount();
    }

    function populateInjury(entry) {
      const select = entry.injurySelect;
      if (!select) return;
      const previous = entry.values?.injury_id;
      select.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Select injury';
      select.appendChild(placeholder);
      state.injuries.forEach((injury) => {
        const option = document.createElement('option');
        option.value = injury.id;
        option.textContent = injury.name || injury.id;
        if (injury.description) option.title = injury.description;
        select.appendChild(option);
      });
      if (previous && state.injuries.some((inj) => inj.id === previous)) {
        select.value = previous;
      }
    }

    function populateSubcategories(entry, initial) {
      const select = entry.subSelect;
      if (!select) return;
      const injuryId = entry.injurySelect ? entry.injurySelect.value : '';
      const options = state.subcategories[injuryId] || [];
      const previous = initial ? entry.values?.injury_subcategory_id : select.value;
      select.innerHTML = '';
      const generalOption = document.createElement('option');
      generalOption.value = '';
      generalOption.textContent = 'General';
      select.appendChild(generalOption);
      options.forEach((sub) => {
        const option = document.createElement('option');
        option.value = sub.id;
        option.textContent = sub.name || sub.id;
        if (sub.definition) option.title = sub.definition;
        select.appendChild(option);
      });
      if (previous && options.some((sub) => sub.id === previous)) {
        select.value = previous;
      }
    }

    function removeEntry(entry) {
      const index = state.entries.indexOf(entry);
      if (index >= 0) state.entries.splice(index, 1);
      if (entry.node && entry.node.parentNode) {
        entry.node.parentNode.removeChild(entry.node);
      }
      updateCount();
    }

    function collect() {
      const errors = [];
      const data = [];
      const seen = new Set();
      state.entries.forEach((entry, index) => {
        const injuryId = entry.injurySelect ? entry.injurySelect.value : '';
        if (!injuryId) {
          errors.push(`Injury ${index + 1}: choose an injury.`);
          return;
        }
        const subId = entry.subSelect ? entry.subSelect.value : '';
        const uniqueKey = `${injuryId}-${subId}`;
        if (seen.has(uniqueKey)) {
          errors.push('Use each injury/subcategory combination at most once.');
          return;
        }
        seen.add(uniqueKey);
        const injury = state.injuries.find((inj) => inj.id === injuryId);
        const sub = (state.subcategories[injuryId] || []).find((item) => item.id === subId);
        data.push({
          injury_id: injuryId,
          injury_name: injury ? injury.name : injuryId,
          injury_subcategory_id: subId || null,
          injury_subcategory_name: sub ? sub.name : null,
          severity: entry.severitySelect ? entry.severitySelect.value : state.defaultSeverity,
          notes: entry.notesInput && entry.notesInput.value ? entry.notesInput.value.trim() : null,
        });
      });
      return { data, errors };
    }

    function prefill(items) {
      if (!Array.isArray(items) || !items.length) return;
      items.forEach((item) => addEntry(item));
      updateCount();
    }

    function updateCount() {
      if (countEl) countEl.textContent = `${state.entries.length} / 10`;
      if (addButton) addButton.disabled = state.entries.length >= 10;
    }

    return {
      setOptions,
      setSeverityOptions,
      collect,
      prefill,
    };
  }

  function createChildPastSportsController({ root }) {
    if (!root) {
      return {
        setClient: () => {},
        setPolicy: () => {},
        collect: () => ({ data: [], errors: [] }),
        prefill: () => {},
      };
    }
    const addButton = root.querySelector('[data-child-past-add]');
    const countEl = root.querySelector('[data-child-past-count]');
    const emptyState = root.querySelector('[data-child-past-empty]');
    const itemsContainer = root.querySelector('[data-child-past-items]');
    const template = root.querySelector('template[data-child-past-template]');

    const MAX_ITEMS = 5;
    const state = {
      intensityOptions: [],
      defaultIntensity: null,
      booleanFields: {
        liked: {
          label: 'Enjoyed it?',
          true_label: 'Yes',
          false_label: 'No',
          unknown_label: 'Select',
        },
        had_flair: {
          label: 'Felt natural?',
          true_label: 'Yes',
          false_label: 'No',
          unknown_label: 'Select',
        },
        achieved_skill: {
          label: 'Good at it?',
          true_label: 'Yes',
          false_label: 'No',
          unknown_label: 'Select',
        },
      },
    };

    let client = null;
    let catalog = null;
    let catalogPromise = null;
    let pendingPrefill = [];
    const pickers = new Set();

    document.addEventListener('click', (event) => {
      pickers.forEach((picker) => {
        if (!picker.root.contains(event.target)) {
          picker.hide();
        }
      });
    });

    if (addButton) {
      addButton.addEventListener('click', async () => {
        if (!client) return;
        await ensureCatalog();
        addItem();
      });
    }

    toggleEmptyState();

    async function setClient(nextClient) {
      client = nextClient;
      if (client && pendingPrefill.length) {
        await ensureCatalog();
        pendingPrefill.forEach((item) => addItem(item));
        pendingPrefill = [];
      }
      toggleEmptyState();
    }

    function setPolicy(policy) {
      const pastSports = policy && typeof policy === 'object' ? policy : {};
      const intensityOptions = Array.isArray(pastSports.intensity_options)
        ? pastSports.intensity_options
            .filter((option) => option && option.id && option.label)
            .map((option) => ({
              id: String(option.id).trim(),
              label: String(option.label).trim(),
              is_default: Boolean(option.is_default),
            }))
        : [];
      state.intensityOptions = intensityOptions;
      state.defaultIntensity =
        (pastSports.default_intensity && String(pastSports.default_intensity).trim()) || null;
      const fields = (pastSports.boolean_options && pastSports.boolean_options.fields) || {};
      state.booleanFields = {
        liked: fields.liked || {
          label: 'Enjoyed it?',
          true_label: 'Yes',
          false_label: 'No',
          unknown_label: 'Select',
        },
        had_flair: fields.had_flair || {
          label: 'Felt natural?',
          true_label: 'Yes',
          false_label: 'No',
          unknown_label: 'Select',
        },
        achieved_skill: fields.achieved_skill || {
          label: 'Good at it?',
          true_label: 'Yes',
          false_label: 'No',
          unknown_label: 'Select',
        },
      };
      refreshExistingItems();
    }

    function toggleEmptyState() {
      const count = itemsContainer ? itemsContainer.querySelectorAll('[data-item]').length : 0;
      if (emptyState) {
        if (!client) {
          emptyState.hidden = false;
          emptyState.textContent = 'Sign in as a guardian to add child past sports.';
        } else {
          emptyState.hidden = count > 0;
          if (!count) {
            emptyState.textContent = 'Add the sports this child has tried. Up to five entries.';
          }
        }
      }
      if (addButton) {
        addButton.disabled = !client || count >= MAX_ITEMS;
      }
      if (countEl) countEl.textContent = `${count} / ${MAX_ITEMS}`;
    }

    async function ensureCatalog() {
      if (catalog) return catalog;
      if (!client) return [];
      if (catalogPromise) return catalogPromise;
      catalogPromise = (async () => {
        const { data, error } = await client
          .from('sports_subcategories', { schema: 'public' })
          .select('id, slug, category')
          .limit(5000);
        if (error) throw error;
        const rows = (data || []).map((row) => {
          const label = buildSportLabel(row);
          return {
            id: row.id,
            label,
            searchText: `${label} ${(row.slug || '').replace(/-/g, ' ')}`.toLowerCase(),
          };
        });
        catalog = rows;
        return catalog;
      })().finally(() => {
        catalogPromise = null;
      });
      return catalogPromise;
    }

    function buildSportLabel(row) {
      const category = row && row.category ? row.category : {};
      const parts = [];
      const preferredKeys = ['sport', 'discipline', 'category', 'subcategory', 'position', 'role'];
      preferredKeys.forEach((key) => {
        const value = category[key];
        if (value && value.name && !parts.includes(value.name)) {
          parts.push(value.name);
        }
      });
      if (!parts.length) {
        Object.values(category).forEach((value) => {
          if (value && value.name && !parts.includes(value.name)) {
            parts.push(value.name);
          }
        });
      }
      if (!parts.length) {
        const slug = row.slug || '';
        return slug.replace(/-/g, ' ').replace(/\s+/g, ' ').trim() || 'Sport';
      }
      return parts.join(' • ');
    }

    function searchCatalog(query) {
      if (!catalog || !catalog.length) return [];
      const trimmed = (query || '').trim().toLowerCase();
      if (!trimmed) return catalog.slice(0, 12);
      const tokens = trimmed.split(/\s+/).filter(Boolean);
      return catalog
        .map((row) => {
          const text = row.searchText;
          const matches = tokens.every((token) => text.includes(token));
          if (!matches) return null;
          const primary = text.indexOf(tokens[0]);
          return { row, score: primary === -1 ? 9999 : primary };
        })
        .filter(Boolean)
        .sort((a, b) => a.score - b.score)
        .slice(0, 12)
        .map((entry) => entry.row);
    }

    function addItem(initial) {
      if (!client || !itemsContainer || !template) return;
      const count = itemsContainer.querySelectorAll('[data-item]').length;
      if (count >= MAX_ITEMS) {
        toggleEmptyState();
        return;
      }

      const fragment = template.content.cloneNode(true);
      const item = fragment.querySelector('[data-item]');
      if (!item) return;

      const searchInput = item.querySelector('[data-field="sport_label"]');
      const hiddenInput = item.querySelector('[data-field="sport_subcategory_id"]');
      const resultsEl = item.querySelector('[data-search-results]');
      const yearsInput = item.querySelector('[data-field="years_played"]');
      const ageInput = item.querySelector('[data-field="age_started_years"]');
      const intensitySelect = item.querySelector('[data-field="intensity"]');
      const likedSelect = item.querySelector('[data-field="liked"]');
      const flairSelect = item.querySelector('[data-field="had_flair"]');
      const skillSelect = item.querySelector('[data-field="achieved_skill"]');
      const likedLabel = item.querySelector('[data-boolean-label="liked"]');
      const flairLabel = item.querySelector('[data-boolean-label="had_flair"]');
      const skillLabel = item.querySelector('[data-boolean-label="achieved_skill"]');
      const removeBtn = item.querySelector('[data-remove]');

      if (resultsEl) {
        resultsEl.setAttribute('role', 'listbox');
        resultsEl.setAttribute('tabindex', '-1');
      }

      applySelectOptions(
        intensitySelect,
        state.intensityOptions,
        'Select',
        (option) => option.id,
        (option) => option.label
      );
      applyBooleanField(likedLabel, likedSelect, state.booleanFields.liked);
      applyBooleanField(flairLabel, flairSelect, state.booleanFields.had_flair);
      applyBooleanField(skillLabel, skillSelect, state.booleanFields.achieved_skill);

      if (yearsInput && initial && initial.years_played != null) yearsInput.value = Number(initial.years_played);
      if (ageInput && initial && initial.age_started_years != null) ageInput.value = Number(initial.age_started_years);
      if (intensitySelect && initial && isAllowedIntensity(initial.intensity)) {
        intensitySelect.value = initial.intensity;
      } else if (intensitySelect && state.defaultIntensity) {
        intensitySelect.value = state.defaultIntensity;
      }
      if (likedSelect && typeof initial?.liked === 'boolean') likedSelect.value = initial.liked ? 'yes' : 'no';
      if (flairSelect && typeof initial?.had_flair === 'boolean') flairSelect.value = initial.had_flair ? 'yes' : 'no';
      if (skillSelect && typeof initial?.achieved_skill === 'boolean') skillSelect.value = initial.achieved_skill ? 'yes' : 'no';

      function selectRow(row) {
        hiddenInput.value = row.id;
        searchInput.value = row.label;
        resultsEl.hidden = true;
        resultsEl.innerHTML = '';
      }

      async function renderMatches(query) {
        await ensureCatalog();
        const matches = searchCatalog(query);
        if (!matches.length) {
          resultsEl.hidden = true;
          resultsEl.innerHTML = '';
          return;
        }
        const fragment = document.createDocumentFragment();
        matches.forEach((row) => {
          const option = document.createElement('button');
          option.type = 'button';
          option.className =
            'flex w-full items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-left text-sm text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500';
          option.setAttribute('role', 'option');
          option.textContent = row.label;
          option.addEventListener('click', () => selectRow(row));
          fragment.appendChild(option);
        });
        resultsEl.innerHTML = '';
        resultsEl.appendChild(fragment);
        resultsEl.hidden = false;
      }

      searchInput.addEventListener('input', () => {
        hiddenInput.value = '';
        renderMatches(searchInput.value);
      });
      searchInput.addEventListener('focus', () => renderMatches(searchInput.value));
      searchInput.addEventListener('blur', () => {
        setTimeout(() => {
          resultsEl.hidden = true;
        }, 120);
      });
      resultsEl.addEventListener('pointerdown', (event) => event.preventDefault());

      pickers.add({
        root: item,
        hide() {
          resultsEl.hidden = true;
        },
      });

      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          item.remove();
          toggleEmptyState();
        });
      }

      if (initial && initial.sport_subcategory_id) {
        ensureCatalog().then(() => {
          const row = catalog ? catalog.find((entry) => entry.id === initial.sport_subcategory_id) : null;
          if (row) selectRow(row);
        });
        hiddenInput.value = initial.sport_subcategory_id;
        searchInput.value = initial.sport_label || initial.sport_subcategory_id;
      }

      itemsContainer.appendChild(item);
      toggleEmptyState();
    }

    function collect() {
      if (!client) return { data: [], errors: [] };
      const items = itemsContainer ? Array.from(itemsContainer.querySelectorAll('[data-item]')) : [];
      const errors = [];
      const data = [];

      items.forEach((item, index) => {
        const hiddenInput = item.querySelector('[data-field="sport_subcategory_id"]');
        const labelInput = item.querySelector('[data-field="sport_label"]');
        const yearsInput = item.querySelector('[data-field="years_played"]');
        const ageInput = item.querySelector('[data-field="age_started_years"]');
        const intensitySelect = item.querySelector('[data-field="intensity"]');
        const likedSelect = item.querySelector('[data-field="liked"]');
        const flairSelect = item.querySelector('[data-field="had_flair"]');
        const skillSelect = item.querySelector('[data-field="achieved_skill"]');

        const sportId = hiddenInput && hiddenInput.value ? hiddenInput.value.trim() : '';
        const sportLabel = labelInput && labelInput.value ? labelInput.value.trim() : '';
        const hasOther = Boolean(
          sportLabel ||
            (yearsInput && yearsInput.value) ||
            (ageInput && ageInput.value) ||
            (intensitySelect && intensitySelect.value)
        );

        if (!sportId) {
          if (hasOther) {
            errors.push(`Past sport ${index + 1}: choose a sport from the list.`);
          }
          return;
        }

        const entry = {
          sport_subcategory_id: sportId,
          sport_label: sportLabel || undefined,
        };

        if (yearsInput && yearsInput.value) {
          const parsed = parseFloat(yearsInput.value);
          if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 80) {
            entry.years_played = parsed;
          } else {
            errors.push(`Past sport ${index + 1}: years played must be between 0 and 80.`);
          }
        }

        if (ageInput && ageInput.value) {
          const parsedAge = parseFloat(ageInput.value);
          if (!Number.isNaN(parsedAge) && parsedAge >= 0 && parsedAge <= 80) {
            entry.age_started_years = parsedAge;
          } else {
            errors.push(`Past sport ${index + 1}: starting age must be between 0 and 80.`);
          }
        }

        if (intensitySelect && intensitySelect.value) {
          const value = intensitySelect.value;
          if (isAllowedIntensity(value)) {
            entry.intensity = value;
          } else {
            errors.push(`Past sport ${index + 1}: select a valid intensity.`);
          }
        }

        const likedBool = mapSelectToBool(likedSelect ? likedSelect.value : '');
        const flairBool = mapSelectToBool(flairSelect ? flairSelect.value : '');
        const skillBool = mapSelectToBool(skillSelect ? skillSelect.value : '');

        if (likedBool !== null) entry.liked = likedBool;
        if (flairBool !== null) entry.had_flair = flairBool;
        if (skillBool !== null) entry.achieved_skill = skillBool;

        data.push(entry);
      });

      return { data, errors };
    }

    function prefill(items) {
      if (!Array.isArray(items) || !items.length) {
        toggleEmptyState();
        return;
      }
      if (!client) {
        pendingPrefill = items.slice();
        toggleEmptyState();
        return;
      }
      items.forEach((item) => addItem(item));
    }

    function mapSelectToBool(value) {
      if (value === 'yes') return true;
      if (value === 'no') return false;
      return null;
    }

    function refreshExistingItems() {
      if (!itemsContainer) return;
      itemsContainer.querySelectorAll('[data-item]').forEach((item) => {
        const intensitySelect = item.querySelector('[data-field="intensity"]');
        const likedSelect = item.querySelector('[data-field="liked"]');
        const flairSelect = item.querySelector('[data-field="had_flair"]');
        const skillSelect = item.querySelector('[data-field="achieved_skill"]');
        const likedLabel = item.querySelector('[data-boolean-label="liked"]');
        const flairLabel = item.querySelector('[data-boolean-label="had_flair"]');
        const skillLabel = item.querySelector('[data-boolean-label="achieved_skill"]');
        applySelectOptions(
          intensitySelect,
          state.intensityOptions,
          'Select',
          (option) => option.id,
          (option) => option.label
        );
        applyBooleanField(likedLabel, likedSelect, state.booleanFields.liked);
        applyBooleanField(flairLabel, flairSelect, state.booleanFields.had_flair);
        applyBooleanField(skillLabel, skillSelect, state.booleanFields.achieved_skill);
      });
    }

    function isAllowedIntensity(value) {
      if (!value) return false;
      return state.intensityOptions.some((option) => option.id === String(value).trim());
    }

    function applySelectOptions(selectEl, options, placeholderLabel, getValue, getLabel) {
      if (!selectEl) return;
      const currentValue = selectEl.value;
      selectEl.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = placeholderLabel;
      selectEl.appendChild(placeholder);
      options.forEach((option) => {
        const el = document.createElement('option');
        el.value = getValue(option);
        el.textContent = getLabel(option);
        selectEl.appendChild(el);
      });
      if (currentValue && Array.from(selectEl.options).some((option) => option.value === currentValue)) {
        selectEl.value = currentValue;
      }
    }

    function applyBooleanField(labelEl, selectEl, config) {
      if (labelEl && config && config.label) {
        labelEl.textContent = config.label;
      }
      applySelectOptions(
        selectEl,
        [
          { value: 'yes', label: config.true_label },
          { value: 'no', label: config.false_label },
        ],
        config.unknown_label,
        (option) => option.value,
        (option) => option.label
      );
    }

    return {
      setClient,
      setPolicy,
      collect,
      prefill,
    };
  }

  async function fetchChildTaxonomy(client) {
    const schemaOpts = { schema: 'public' };
    const [prefRes, goalRes, injuryRes, subRes] = await Promise.all([
      client.from('preferences_catalog', schemaOpts).select('id, name, description').order('name', { ascending: true }),
      client.from('goals_catalog', schemaOpts).select('id, name, description').order('name', { ascending: true }),
      client.from('injuries_catalog', schemaOpts).select('id, name, description').order('name', { ascending: true }),
      client
        .from('injury_subcategories_catalog', schemaOpts)
        .select('id, injury_id, name, definition, symptoms, causes, treatment')
        .order('name', { ascending: true }),
    ]);

    if (prefRes.error) throw prefRes.error;
    if (goalRes.error) throw goalRes.error;
    if (injuryRes.error) throw injuryRes.error;
    if (subRes.error) throw subRes.error;

    const injurySubcategories = {};
    (subRes.data || []).forEach((row) => {
      const list = injurySubcategories[row.injury_id] || [];
      list.push(row);
      injurySubcategories[row.injury_id] = list;
    });

    return {
      preferences: prefRes.data || [],
      goals: goalRes.data || [],
      injuries: injuryRes.data || [],
      injurySubcategories,
    };
  }
})();
