(function () {
  const form = document.querySelector('[data-intake-form]');
  const statusEl = document.querySelector('[data-status]');
  const submitBtn = document.querySelector('[data-submit]');
  const bannerTextEl = document.querySelector('[data-intake-banner]');
  const premiumBlock = document.querySelector('[data-premium-block]');
  const premiumLocked = document.querySelector('[data-premium-locked]');
  const premiumLockedMessage = premiumLocked
    ? premiumLocked.querySelector('[data-premium-locked-message]')
    : null;
  const premiumSummaryEl = document.querySelector('[data-premium-summary]');
  const sportyApp = window.SportyApp;
  let sportySnapshot = { user: null, hasConsent: false };
  const premiumController = createPremiumController({
    block: premiumBlock,
    locked: premiumLocked,
    lockedMessage: premiumLockedMessage,
    summary: premiumSummaryEl,
    getClient: () => (sportyApp && typeof sportyApp.getClient === 'function' ? sportyApp.getClient() : null),
  });

  if (!form) {
    updateBanner(sportySnapshot);
    premiumController.update(sportySnapshot);
    return;
  }

  if (sportyApp && sportyApp.ready) {
    sportyApp.ready.then(() => {
      if (typeof sportyApp.onAuthChange === 'function') {
        sportyApp.onAuthChange((snapshot) => {
          processAuthSnapshot(snapshot);
        });
      } else {
        processAuthSnapshot(sportySnapshot);
      }
    });
  } else {
    processAuthSnapshot(sportySnapshot);
  }

  function setStatus(html, type = 'info') {
    if (!statusEl) return;
    statusEl.innerHTML = html ? `<div class="status status--${type}">${html}</div>` : '';
  }

  function updateBanner(snapshot) {
    if (!bannerTextEl) return;
    if (snapshot && snapshot.user) {
      bannerTextEl.textContent = snapshot.hasConsent
        ? 'You are signed in. Measurements and results will be stored automatically.'
        : 'You are signed in. Grant data-retention consent from your profile to store future results.';
    } else {
      bannerTextEl.textContent =
        'Share a handful of measurements and we’ll return your top three sports instantly. Log in and consent to save your results for later.';
    }
  }

  function processAuthSnapshot(snapshot) {
    sportySnapshot = snapshot || { user: null, hasConsent: false };
    updateBanner(sportySnapshot);
    Promise.resolve(premiumController.update(sportySnapshot)).catch((error) => {
      console.error('Failed to update premium intake state', error);
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!submitBtn) return;

    const fd = new FormData(form);
    const payload = {
      birthday: fd.get('birthday'),
      sex: fd.get('sex') || 'prefer_not_to_say',
      height_cm: Number(fd.get('height_cm')) || null,
      weight_kg: Number(fd.get('weight_kg')) || null,
      arm_span_cm: fd.get('arm_span_cm') ? Number(fd.get('arm_span_cm')) : null,
      leg_inseam_cm: fd.get('leg_inseam_cm') ? Number(fd.get('leg_inseam_cm')) : null,
      shoulder_width_cm: fd.get('shoulder_width_cm') ? Number(fd.get('shoulder_width_cm')) : null,
      hip_width_cm: fd.get('hip_width_cm') ? Number(fd.get('hip_width_cm')) : null,
      hand_length_cm: fd.get('hand_length_cm') ? Number(fd.get('hand_length_cm')) : null,
      foot_length_cm: fd.get('foot_length_cm') ? Number(fd.get('foot_length_cm')) : null,
    };

    if (!payload.birthday || !payload.height_cm || !payload.weight_kg) {
      setStatus('Birthday, height, and weight are required to generate a suggestion.', 'error');
      return;
    }

    const premiumSelection = premiumController.collect();
    if (premiumSelection && premiumSelection.errors && premiumSelection.errors.length) {
      setStatus(premiumSelection.errors.join(' '), 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Generating…';
    setStatus('Crunching the numbers…', 'info');

    let consentAccepted = sportySnapshot.hasConsent;
      if (
        sportyApp &&
        sportySnapshot.user &&
        !sportySnapshot.hasConsent &&
        typeof sportyApp.ensureConsent === 'function'
      ) {
        try {
          consentAccepted = await sportyApp.ensureConsent();
          premiumController.setConsent(consentAccepted);
        } catch (error) {
          console.error('Consent prompt failed', error);
          consentAccepted = false;
        }
        if (!consentAccepted) {
        setStatus(
          'To keep your data private, log out before running another match or enable storage in your profile.',
          'error'
        );
      }
    }

    try {
      const response = await fetch('/api/recommend-adult-free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const bodyText = await response.text();

      if (!response.ok) {
        let detail = 'We could not generate a suggestion right now.';
        try {
          const json = JSON.parse(bodyText);
          detail = json.detail || detail;
        } catch (_) {}
        throw new Error(detail);
      }

      sessionStorage.setItem('sporty:lastResult', bodyText);

      if (consentAccepted && sportyApp && typeof sportyApp.saveRecommendation === 'function') {
        try {
          const resultJson = JSON.parse(bodyText);
          const extras =
            premiumSelection && premiumSelection.data
              ? { analysisInput: premiumSelection.data }
              : undefined;
          const saveOutcome = await sportyApp.saveRecommendation(payload, resultJson, extras);
          if (saveOutcome && saveOutcome.saved) {
            setStatus('Saved to your account. Redirecting…', 'info');
          }
        } catch (error) {
          console.error('Failed to persist recommendation', error);
        }
      }

      window.location.assign('/results');
    } catch (error) {
      setStatus(error.message || 'Unexpected error, please try again.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'See my matches';
    }
  });

  // Prefill measurements on test/staging branches for faster QA
  if (isTestBranch()) {
    prefillForTest();
  }

  function createPremiumController(config) {
    const {
      block,
      locked,
      lockedMessage,
      summary,
      getClient,
    } = config || {};
    const MAX_ITEMS = 20;

    const preferenceList = createPriorityList(
      block ? block.querySelector('[data-list="preferences"]') : null,
      {
        label: 'Preference',
        keyField: 'preference_id',
        max: MAX_ITEMS,
      }
    );
    const goalList = createPriorityList(
      block ? block.querySelector('[data-list="goals"]') : null,
      {
        label: 'Goal',
        keyField: 'goal_id',
        max: MAX_ITEMS,
      }
    );
    const injuryList = createInjuryList(
      block ? block.querySelector('[data-list="injuries"]') : null,
      {
        max: MAX_ITEMS,
      }
    );

    const taxonomyCache = { promise: null, value: null };
    let active = false;
    let consentGranted = false;
    let creditCount = 0;
    let lastUserId = null;
    let updateToken = 0;

    function defaultLockedMessage() {
      return 'Premium credits let you capture preferences, goals, and injuries alongside your measurements. Sign in and apply a credit to unlock deeper tailoring.';
    }

    function updateSummary() {
      if (!summary) return;
      if (!active) {
        summary.textContent = '';
        return;
      }
      const creditText =
        creditCount === 1
          ? '1 adult analysis credit available.'
          : `${creditCount} adult analysis credits available.`;
      summary.textContent = consentGranted
        ? `${creditText} Add up to 20 entries per category before submitting your detailed analysis.`
        : `${creditText} Enable data-retention consent when prompted so we can store these detailed inputs.`;
    }

    function activate() {
      active = true;
      if (locked) locked.hidden = true;
      if (block) block.hidden = false;
      updateSummary();
    }

    function deactivate(message) {
      active = false;
      creditCount = 0;
      if (block) block.hidden = true;
      if (summary) summary.textContent = '';
      if (locked) locked.hidden = false;
      if (lockedMessage) {
        lockedMessage.textContent = message || defaultLockedMessage();
      }
      preferenceList.reset();
      goalList.reset();
      injuryList.reset();
    }

    async function fetchTaxonomy(client) {
      if (!client) return null;
      if (taxonomyCache.value) return taxonomyCache.value;
      if (taxonomyCache.promise) return taxonomyCache.promise;

      taxonomyCache.promise = (async () => {
        const [prefRes, goalRes, injuryRes, subRes] = await Promise.all([
          client
            .from('preferences_catalog')
            .select('id, name, description')
            .order('name', { ascending: true }),
          client
            .from('goals_catalog')
            .select('id, name, description')
            .order('name', { ascending: true }),
          client
            .from('injuries_catalog')
            .select('id, name, description')
            .order('name', { ascending: true }),
          client
            .from('injury_subcategories_catalog')
            .select('id, injury_id, name, definition, symptoms, causes, treatment')
            .order('name', { ascending: true }),
        ]);

        if (prefRes.error) throw prefRes.error;
        if (goalRes.error) throw goalRes.error;
        if (injuryRes.error) throw injuryRes.error;
        if (subRes.error) throw subRes.error;

        const injurySubcategories = {};
        (subRes.data || []).forEach((row) => {
          if (!injurySubcategories[row.injury_id]) {
            injurySubcategories[row.injury_id] = [];
          }
          injurySubcategories[row.injury_id].push(row);
        });

        const value = {
          preferences: prefRes.data || [],
          goals: goalRes.data || [],
          injuries: injuryRes.data || [],
          injurySubcategories,
        };
        taxonomyCache.value = value;
        return value;
      })().finally(() => {
        taxonomyCache.promise = null;
      });

      return taxonomyCache.promise;
    }

    async function fetchAdultCredits(client, userId) {
      if (!client || !userId) return { availableCount: 0, rows: [] };
      const { data, error } = await client
        .from('analysis_credits')
        .select('id, remaining, credit_type, consumed_at')
        .eq('user_id', userId)
        .eq('credit_type', 'adult');
      if (error) throw error;
      const rows = data || [];
      const availableCount = rows.reduce((total, row) => {
        const remaining = Number(row.remaining) || 0;
        return remaining > 0 ? total + remaining : total;
      }, 0);
      return { availableCount, rows };
    }

    return {
      async update(snapshot) {
        consentGranted = snapshot && snapshot.hasConsent;
        const client = typeof getClient === 'function' ? getClient() : null;
        const userId = snapshot && snapshot.user ? snapshot.user.id : null;
        const currentToken = ++updateToken;

        if (!block || !locked) {
          return;
        }

        if (!userId || !client) {
          lastUserId = null;
          deactivate();
          return;
        }

        lastUserId = userId;

        let credits;
        try {
          credits = await fetchAdultCredits(client, userId);
        } catch (error) {
          console.error('Failed to load premium credits', error);
          if (currentToken === updateToken) {
            deactivate('Unable to confirm your premium credits right now. Please try again in a moment.');
          }
          return;
        }

        if (currentToken !== updateToken) return;

        creditCount = credits.availableCount || 0;

        if (creditCount <= 0) {
          deactivate('Add an adult analysis credit to unlock detailed inputs.');
          return;
        }

        let taxonomy;
        try {
          taxonomy = await fetchTaxonomy(client);
        } catch (error) {
          console.error('Failed to load premium taxonomy', error);
          if (currentToken === updateToken) {
            deactivate('We could not load premium input options. Refresh and try again.');
          }
          return;
        }

        if (currentToken !== updateToken) return;

        if (!taxonomy) {
          deactivate('We could not load premium input options. Refresh and try again.');
          return;
        }

        preferenceList.setOptions(taxonomy.preferences || []);
        goalList.setOptions(taxonomy.goals || []);
        injuryList.setOptions(taxonomy.injuries || [], taxonomy.injurySubcategories || {});
        activate();
      },
      collect() {
        if (!active) return null;
        const pref = preferenceList.collect();
        const goals = goalList.collect();
        const injuries = injuryList.collect();
        const errors = [];
        if (pref.errors.length) errors.push(...pref.errors);
        if (goals.errors.length) errors.push(...goals.errors);
        if (injuries.errors.length) errors.push(...injuries.errors);

        const hasData = pref.data.length || goals.data.length || injuries.data.length;
        const data = hasData
          ? {
              preferences: pref.data,
              goals: goals.data,
              injuries: injuries.data,
            }
          : null;

        return { data, errors };
      },
      setConsent(consent) {
        consentGranted = Boolean(consent);
        updateSummary();
      },
      reset() {
        deactivate();
      },
    };
  }

  function createPriorityList(root, config) {
    const fallback = {
      setOptions: () => {},
      collect: () => ({ data: [], errors: [] }),
      reset: () => {},
    };
    if (!root) return fallback;

    const itemsContainer = root.querySelector('[data-items]');
    const template = root.querySelector('template[data-template]');
    const countEl = root.querySelector('[data-count]');
    const emptyEl = root.querySelector('[data-empty]');
    const addBtn = root.querySelector('[data-add]');

    if (!itemsContainer || !template) return fallback;

    const state = {
      options: [],
      entries: [],
    };

    if (addBtn) {
      addBtn.addEventListener('click', () => addEntry());
    }

    function setOptions(options) {
      state.options = Array.isArray(options) ? options.slice() : [];
      state.options.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      refreshAll();
      updateUI();
    }

    function addEntry(defaultId) {
      if (!hasCapacity()) return;
      const clone = template.content.cloneNode(true);
      const node = clone.querySelector('[data-item]') || clone.firstElementChild;
      if (!node) return;
      const select = node.querySelector(`[data-field="${config.keyField}"]`);
      const priority = node.querySelector('[data-field="priority"]');
      const removeBtn = node.querySelector('[data-remove]');
      const entry = { node, select, priority };

      if (removeBtn) {
        removeBtn.addEventListener('click', () => removeEntry(entry));
      }
      if (select) {
        select.addEventListener('change', () => refreshAll());
      }
      if (priority && !priority.value) {
        priority.value = 'must_have';
      }

      state.entries.push(entry);
      itemsContainer.appendChild(node);

      const targetId = defaultId || findFirstAvailableId(entry);
      populateSelect(entry, targetId);
      updateUI();
    }

    function removeEntry(entry) {
      const index = state.entries.indexOf(entry);
      if (index >= 0) {
        state.entries.splice(index, 1);
      }
      if (entry.node && entry.node.parentNode) {
        entry.node.parentNode.removeChild(entry.node);
      }
      updateUI();
      refreshAll();
    }

    function findFirstAvailableId(currentEntry) {
      const used = new Set(
        state.entries
          .filter((entry) => entry !== currentEntry)
          .map((entry) => (entry.select ? entry.select.value : ''))
          .filter(Boolean)
      );
      const available = state.options.find((opt) => !used.has(opt.id));
      return available ? available.id : '';
    }

    function populateSelect(entry, desiredId) {
      const select = entry.select;
      if (!select) return;
      const currentValue = desiredId || select.value;
      const used = new Set(
        state.entries
          .filter((other) => other !== entry)
          .map((other) => (other.select ? other.select.value : ''))
          .filter(Boolean)
      );

      select.innerHTML = '';

      state.options.forEach((opt) => {
        const optionEl = document.createElement('option');
        optionEl.value = opt.id;
        optionEl.textContent = opt.name;
        if (opt.description) optionEl.title = opt.description;
        if (used.has(opt.id) && opt.id !== currentValue) {
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

      if (currentValue && state.options.some((opt) => opt.id === currentValue)) {
        select.value = currentValue;
      } else {
        const firstAvailable = Array.from(select.options).find((opt) => !opt.disabled);
        select.value = firstAvailable ? firstAvailable.value : '';
      }
    }

    function refreshAll() {
      state.entries.forEach((entry) => {
        populateSelect(entry, entry.select ? entry.select.value : '');
      });
      if (addBtn) addBtn.disabled = !hasCapacity();
    }

    function hasCapacity() {
      const optionLimit = state.options.length ? Math.min(config.max, state.options.length) : config.max;
      if (!state.options.length) return false;
      if (state.entries.length >= optionLimit) return false;
      const used = new Set(
        state.entries
          .map((entry) => (entry.select ? entry.select.value : ''))
          .filter(Boolean)
      );
      return state.options.some((opt) => !used.has(opt.id));
    }

    function updateUI() {
      const optionLimit = state.options.length ? Math.min(config.max, state.options.length) : config.max;
      if (countEl) countEl.textContent = `${state.entries.length} / ${optionLimit}`;
      if (emptyEl) emptyEl.hidden = state.entries.length > 0;
      if (addBtn) addBtn.disabled = !hasCapacity();
    }

    function collect() {
      const data = [];
      const errors = [];
      const seen = new Set();

      state.entries.forEach((entry) => {
        const select = entry.select;
        const value = select ? select.value : '';
        if (!value) {
          errors.push(`Select a ${config.label.toLowerCase()} for each entry.`);
          return;
        }
        if (seen.has(value)) {
          errors.push(`Each ${config.label.toLowerCase()} can only be chosen once.`);
          return;
        }
        seen.add(value);
        const priority = entry.priority && entry.priority.value ? entry.priority.value : 'nice_to_have';
        data.push({
          [config.keyField]: value,
          priority,
        });
      });

      return { data, errors };
    }

    function reset() {
      state.entries.forEach((entry) => {
        if (entry.node && entry.node.parentNode) {
          entry.node.parentNode.removeChild(entry.node);
        }
      });
      state.entries = [];
      updateUI();
    }

    return {
      setOptions,
      collect,
      reset,
    };
  }

  function createInjuryList(root, config) {
    const fallback = {
      setOptions: () => {},
      collect: () => ({ data: [], errors: [] }),
      reset: () => {},
    };
    if (!root) return fallback;

    const itemsContainer = root.querySelector('[data-items]');
    const template = root.querySelector('template[data-template]');
    const countEl = root.querySelector('[data-count]');
    const emptyEl = root.querySelector('[data-empty]');
    const addBtn = root.querySelector('[data-add]');

    if (!itemsContainer || !template) return fallback;

    const state = {
      injuries: [],
      subcategories: {},
      entries: [],
    };

    if (addBtn) {
      addBtn.addEventListener('click', () => addEntry());
    }

    function setOptions(injuries, subcategories) {
      state.injuries = Array.isArray(injuries) ? injuries.slice() : [];
      state.injuries.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      state.subcategories = {};
      if (subcategories && typeof subcategories === 'object') {
        Object.entries(subcategories).forEach(([injuryId, list]) => {
          state.subcategories[injuryId] = Array.isArray(list)
            ? list.slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''))
            : [];
        });
      }
      state.entries.forEach((entry) => populateInjuryOptions(entry, entry.injurySelect ? entry.injurySelect.value : ''));
      updateUI();
    }

    function addEntry(defaultInjuryId) {
      if (!hasCapacity()) return;
      if (!state.injuries.length) return;

      const clone = template.content.cloneNode(true);
      const node = clone.querySelector('[data-item]') || clone.firstElementChild;
      if (!node) return;

      const injurySelect = node.querySelector('[data-field="injury_id"]');
      const subcategorySelect = node.querySelector('[data-field="injury_subcategory_id"]');
      const severitySelect = node.querySelector('[data-field="severity"]');
      const notesInput = node.querySelector('[data-field="notes"]');
      const removeBtn = node.querySelector('[data-remove]');

      const entry = {
        node,
        injurySelect,
        subcategorySelect,
        severitySelect,
        notesInput,
      };

      state.entries.push(entry);
      itemsContainer.appendChild(node);

      if (injurySelect) {
        injurySelect.addEventListener('change', () => {
          updateSubcategoryOptions(entry);
        });
      }

      if (removeBtn) {
        removeBtn.addEventListener('click', () => removeEntry(entry));
      }

      populateInjuryOptions(entry, defaultInjuryId || '');
      updateSubcategoryOptions(entry, true);
      if (severitySelect && !severitySelect.value) {
        severitySelect.value = 'somewhat_bad';
      }
      updateUI();
    }

    function removeEntry(entry) {
      const index = state.entries.indexOf(entry);
      if (index >= 0) state.entries.splice(index, 1);
      if (entry.node && entry.node.parentNode) {
        entry.node.parentNode.removeChild(entry.node);
      }
      updateUI();
    }

    function populateInjuryOptions(entry, desiredId) {
      const select = entry.injurySelect;
      if (!select) return;
      const currentValue = desiredId || select.value;

      select.innerHTML = '';

      state.injuries.forEach((injury) => {
        const optionEl = document.createElement('option');
        optionEl.value = injury.id;
        optionEl.textContent = injury.name;
        if (injury.description) optionEl.title = injury.description;
        select.appendChild(optionEl);
      });

      if (!state.injuries.length) {
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'No injuries available';
        placeholder.disabled = true;
        placeholder.selected = true;
        select.appendChild(placeholder);
      }

      if (currentValue && state.injuries.some((injury) => injury.id === currentValue)) {
        select.value = currentValue;
      } else if (state.injuries.length) {
        select.value = state.injuries[0].id;
      } else {
        select.value = '';
      }

      updateSubcategoryOptions(entry, true);
    }

    function updateSubcategoryOptions(entry, preserveValue = false) {
      const select = entry.subcategorySelect;
      if (!select) return;
      const injuryId = entry.injurySelect ? entry.injurySelect.value : '';
      const subcategories = state.subcategories[injuryId] || [];
      const previous = preserveValue ? select.value : '';

      select.innerHTML = '';

      const generalOption = document.createElement('option');
      generalOption.value = '';
      generalOption.textContent = 'General';
      select.appendChild(generalOption);

      subcategories.forEach((sub) => {
        const optionEl = document.createElement('option');
        optionEl.value = sub.id;
        optionEl.textContent = sub.name;
        if (sub.definition) optionEl.title = sub.definition;
        select.appendChild(optionEl);
      });

      if (previous && subcategories.some((sub) => sub.id === previous)) {
        select.value = previous;
      } else {
        select.value = '';
      }
    }

    function hasCapacity() {
      if (!state.injuries.length) return false;
      return state.entries.length < config.max;
    }

    function updateUI() {
      if (countEl) countEl.textContent = `${state.entries.length} / ${config.max}`;
      if (emptyEl) emptyEl.hidden = state.entries.length > 0;
      if (addBtn) addBtn.disabled = !hasCapacity();
    }

    function collect() {
      const data = [];
      const errors = [];
      const seen = new Set();

      state.entries.forEach((entry) => {
        const injuryId = entry.injurySelect ? entry.injurySelect.value : '';
        const subcategoryId = entry.subcategorySelect ? entry.subcategorySelect.value : '';
        const severity = entry.severitySelect && entry.severitySelect.value ? entry.severitySelect.value : 'somewhat_bad';
        const notes = entry.notesInput && entry.notesInput.value ? entry.notesInput.value.trim() : null;

        if (!injuryId) {
          errors.push('Select an injury for each entry.');
          return;
        }

        const uniqueKey = subcategoryId || injuryId;
        if (seen.has(uniqueKey)) {
          errors.push('Each injury or specific area can only be listed once.');
          return;
        }
        seen.add(uniqueKey);

        data.push({
          injury_id: injuryId,
          injury_subcategory_id: subcategoryId || null,
          severity,
          notes,
        });
      });

      return { data, errors };
    }

    function reset() {
      state.entries.forEach((entry) => {
        if (entry.node && entry.node.parentNode) {
          entry.node.parentNode.removeChild(entry.node);
        }
      });
      state.entries = [];
      updateUI();
    }

    return {
      setOptions,
      collect,
      reset,
    };
  }

  function isTestBranch() {
    const host = window.location.hostname || '';
    return /test/i.test(host) || host.endsWith('.workers.dev') || host === 'localhost';
  }

  function prefillForTest() {
    const preset = {
      birthday: '1998-06-01',
      sex: 'female',
      height_cm: 178,
      weight_kg: 70,
      arm_span_cm: 182,
      leg_inseam_cm: 85,
      shoulder_width_cm: 42,
      hip_width_cm: 35,
      hand_length_cm: 19,
      foot_length_cm: 25,
    };

    Object.entries(preset).forEach(([key, value]) => {
      const field = form.elements.namedItem(key);
      if (!field) return;

      if (field instanceof RadioNodeList) {
        field.value = value;
        return;
      }

      if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
        if (field.type === 'checkbox') {
          field.checked = Boolean(value);
        } else {
          field.value = value;
        }
      }
    });
  }
})();
