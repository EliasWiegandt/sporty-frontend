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
  const pastSportsSection = document.querySelector('[data-past-sports]');
  const stickyBar = document.querySelector('[data-sticky-submit]');
  const stickyButton = stickyBar ? stickyBar.querySelector('[data-sticky-button]') : null;
  const submitAnchor = document.querySelector('[data-submit-anchor]');
  const sportyApp = window.SportyApp;
  let sportySnapshot = { user: null, hasConsent: false };
  const MEASUREMENT_FIELDS = [
    { name: 'height_cm', label: 'Height (cm)' },
    { name: 'weight_kg', label: 'Weight (kg)' },
    { name: 'arm_span_cm', label: 'Arm span (cm)' },
    { name: 'leg_inseam_cm', label: 'Leg inseam (cm)' },
    { name: 'shoulder_width_cm', label: 'Shoulder width (cm)' },
    { name: 'hip_width_cm', label: 'Hip width (cm)' },
    { name: 'hand_length_cm', label: 'Hand length (cm)' },
    { name: 'foot_length_cm', label: 'Foot length (cm)' },
  ];
  const initialSubmitLabel = submitBtn ? submitBtn.textContent.trim() : 'See my matches';
  const premiumController = createPremiumController({
    block: premiumBlock,
    locked: premiumLocked,
    lockedMessage: premiumLockedMessage,
    summary: premiumSummaryEl,
    getClient: () => (sportyApp && typeof sportyApp.getClient === 'function' ? sportyApp.getClient() : null),
  });
  const pastSportsController = createPastSportsController({
    root: pastSportsSection,
    getClient: () => (sportyApp && typeof sportyApp.getClient === 'function' ? sportyApp.getClient() : null),
  });

  if (stickyButton && submitBtn) {
    stickyButton.textContent = initialSubmitLabel;
    stickyButton.addEventListener('click', (event) => {
      event.preventDefault();
      submitBtn.click();
    });
  } else if (stickyBar) {
    stickyBar.hidden = true;
  }

  initializeInputPairs();
  initializeSticky();

  if (!form) {
    updateBanner(sportySnapshot);
    premiumController.update(sportySnapshot);
    pastSportsController.update(sportySnapshot);
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
    Promise.resolve(pastSportsController.update(sportySnapshot)).catch((error) => {
      console.error('Failed to update past sports', error);
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!submitBtn) return;

    if (typeof form.reportValidity === 'function' && !form.reportValidity()) {
      return;
    }

    const fd = new FormData(form);
    const missingMeasurements = [];
    const invalidMeasurements = [];
    const measurementPayload = {};

    MEASUREMENT_FIELDS.forEach((field) => {
      const raw = fd.get(field.name);
      if (raw === null || raw === '') {
        missingMeasurements.push(field.label);
        return;
      }
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        invalidMeasurements.push(field.label);
        return;
      }
      measurementPayload[field.name] = value;
    });

    if (missingMeasurements.length) {
      setStatus('Fill out all body measurements before continuing.', 'error');
      return;
    }

    if (invalidMeasurements.length) {
      setStatus('Measurements must be numbers. Please double-check your entries.', 'error');
      return;
    }

    const rawSex = fd.get('sex');
    const resolvedSex = rawSex ? String(rawSex) : '';

    const payload = {
      birthday: fd.get('birthday'),
      sex: resolvedSex || 'prefer_not_to_say',
      ...measurementPayload,
    };

    if (!payload.birthday) {
      setStatus('Birthday is required to generate a suggestion.', 'error');
      return;
    }

    if (!resolvedSex) {
      setStatus('Select the sex assigned at birth so we can benchmark accurately.', 'error');
      return;
    }

    const premiumSelection = premiumController.collect();
    if (premiumSelection && premiumSelection.errors && premiumSelection.errors.length) {
      setStatus(premiumSelection.errors.join(' '), 'error');
      return;
    }

    const pastSportsSelection = pastSportsController.collect();
    if (pastSportsSelection && pastSportsSelection.errors && pastSportsSelection.errors.length) {
      setStatus(pastSportsSelection.errors.join(' '), 'error');
      return;
    }

    if (pastSportsSelection && Array.isArray(pastSportsSelection.data)) {
      payload.past_sports = pastSportsSelection.data;
    }

    setSubmitBusy(true);
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
          const extraPayload = {};
          if (premiumSelection && premiumSelection.data) {
            extraPayload.analysisInput = premiumSelection.data;
          }
          if (pastSportsSelection && Array.isArray(pastSportsSelection.data) && pastSportsSelection.data.length) {
            extraPayload.pastSports = pastSportsSelection.data;
          }
          const extras = Object.keys(extraPayload).length ? extraPayload : undefined;
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
      setSubmitBusy(false);
    }
  });

  // Prefill measurements on test/staging branches for faster QA
  if (isTestBranch()) {
    prefillForTest();
  }

  function setSubmitBusy(isBusy) {
    if (submitBtn) {
      submitBtn.disabled = isBusy;
      submitBtn.textContent = isBusy ? 'Generating…' : initialSubmitLabel;
    }
    if (stickyButton) {
      stickyButton.disabled = isBusy;
      stickyButton.textContent = isBusy ? 'Generating…' : initialSubmitLabel;
    }
  }

  function initializeInputPairs() {
    const pairs = document.querySelectorAll('[data-input-pair]');
    pairs.forEach((pair) => {
      if (pair.dataset.enhanced === 'true') return;
      const numberInput = pair.querySelector('[data-pair-input]');
      const rangeInput = pair.querySelector('[data-pair-range]');
      if (!numberInput || !rangeInput) {
        pair.dataset.enhanced = 'true';
        return;
      }
      const chip = pair.querySelector('[data-percentile]');
      const unit = chip ? chip.dataset.unit || '' : '';
      const updateChip = () => {
        if (!chip) return;
        if (!numberInput.value) {
          chip.textContent = 'Value —';
        } else {
          chip.textContent = `Value: ${numberInput.value}${unit ? ` ${unit}` : ''}`;
        }
      };
      const syncRange = () => {
        if (numberInput.value === '' || numberInput.value === null) {
          updateChip();
          return;
        }
        rangeInput.value = numberInput.value;
        updateChip();
      };
      const syncNumber = (triggerEvent = false) => {
        numberInput.value = rangeInput.value;
        updateChip();
        if (triggerEvent) {
          numberInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      };
      numberInput.addEventListener('input', syncRange);
      numberInput.addEventListener('change', syncRange);
      rangeInput.addEventListener('input', () => syncNumber(true));
      updateChip();
      pair.dataset.enhanced = 'true';
    });
  }

  function initializeSticky() {
    if (!stickyBar || !submitAnchor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        stickyBar.hidden = entry.isIntersecting;
      },
      { threshold: 0.4 }
    );
    observer.observe(submitAnchor);
  }

  function createPastSportsController(config) {
    const { root, getClient } = config || {};
    const MAX_ITEMS = 5;
    const INTENSITY_VALUES = ['light', 'moderate', 'intense', 'elite'];
    if (!root) {
      return {
        update: async () => {},
        collect: () => ({ data: [], errors: [] }),
        prefillForTest: () => {},
      };
    }

    const addButton = root.querySelector('[data-past-add]');
    const itemsContainer = root.querySelector('[data-past-items]');
    const emptyState = root.querySelector('[data-past-empty]');
    const countEl = root.querySelector('[data-past-count]');
    const template = root.querySelector('[data-past-template]');

    let catalog = null;
    let catalogPromise = null;
    let active = false;
    let updateToken = 0;
    let prefillRequested = false;

    const pickers = new Set();

    document.addEventListener('click', (event) => {
      pickers.forEach((picker) => {
        if (!picker.root.contains(event.target)) {
          picker.hide();
        }
      });
    });

    if (addButton) {
      addButton.addEventListener('click', () => {
        if (!active) return;
        if (itemsContainer && itemsContainer.querySelectorAll('[data-item]').length >= MAX_ITEMS) {
          return;
        }
        addItem();
      });
    }

    function updateCount() {
      if (!countEl) return;
      const count = itemsContainer ? itemsContainer.querySelectorAll('[data-item]').length : 0;
      countEl.textContent = `${count} / ${MAX_ITEMS}`;
    }

    function toggleEmptyState(message) {
      const count = itemsContainer ? itemsContainer.querySelectorAll('[data-item]').length : 0;
      if (emptyState) {
        if (!active) {
          emptyState.hidden = false;
          emptyState.textContent = message || 'Log in to add past sports and experiences.';
        } else {
          emptyState.hidden = count > 0;
          if (!count) {
            emptyState.textContent = 'Add the sports you’ve invested time in. You can add up to five.';
          }
        }
      }
      if (addButton) {
        addButton.disabled = !active || count >= MAX_ITEMS;
      }
    }

    function clearItems() {
      if (itemsContainer) {
        itemsContainer.innerHTML = '';
      }
      pickers.clear();
      updateCount();
    }

    function setLoggedOutState() {
      active = false;
      clearItems();
      toggleEmptyState();
    }

    function setActiveState() {
      if (active) return;
      active = true;
      toggleEmptyState();
      if (itemsContainer && !itemsContainer.querySelector('[data-item]')) {
        addItem();
      }
    }

    function buildLabel(row) {
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
        return slug.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
      }
      return parts.join(' • ');
    }

    async function ensureCatalog(client) {
      if (catalog) return catalog;
      if (!client) return [];
      if (catalogPromise) return catalogPromise;
      catalogPromise = (async () => {
        const { data, error } = await client
          .from('sports_subcategories')
          .select('id, slug, category')
          .order('slug', { ascending: true });
        if (error) throw error;
        catalog = (data || []).map((row) => {
          const label = buildLabel(row);
          return {
            id: row.id,
            slug: row.slug,
            label,
            searchText: `${label} ${row.slug}`.toLowerCase(),
          };
        });
        return catalog;
      })().finally(() => {
        catalogPromise = null;
      });
      return catalogPromise;
    }

    function searchCatalog(query) {
      if (!catalog || !catalog.length) return [];
      const trimmed = (query || '').trim().toLowerCase();
      if (!trimmed) {
        return catalog.slice(0, 12);
      }
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

    async function fetchExisting(client, userId) {
      const { data, error } = await client
        .from('past_sports')
        .select(
          'sport_subcategory_id, years_played, age_started_years, intensity, liked, had_flair, achieved_skill'
        )
        .eq('subject_user_id', userId)
        .eq('subject_type', 'adult')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }

    function addItem(initial) {
      if (!itemsContainer || !template) return;
      const count = itemsContainer.querySelectorAll('[data-item]').length;
      if (count >= MAX_ITEMS) {
        toggleEmptyState();
        return;
      }

      const fragment = template.content.cloneNode(true);
      const item = fragment.querySelector('[data-item]');
      if (!item) return;

      const yearsInput = item.querySelector('[data-field="years_played"]');
      const ageInput = item.querySelector('[data-field="age_started_years"]');
      const intensitySelect = item.querySelector('[data-field="intensity"]');
      const likedSelect = item.querySelector('[data-field="liked"]');
      const flairSelect = item.querySelector('[data-field="had_flair"]');
      const skillSelect = item.querySelector('[data-field="achieved_skill"]');

      if (yearsInput && initial && typeof initial.years_played !== 'undefined' && initial.years_played !== null) {
        yearsInput.value = Number(initial.years_played);
      }
      if (ageInput && initial && typeof initial.age_started_years !== 'undefined' && initial.age_started_years !== null) {
        ageInput.value = Number(initial.age_started_years);
      }
      if (intensitySelect && initial && initial.intensity && INTENSITY_VALUES.includes(initial.intensity)) {
        intensitySelect.value = initial.intensity;
      }
      if (likedSelect && initial && typeof initial.liked === 'boolean') {
        likedSelect.value = initial.liked ? 'yes' : 'no';
      }
      if (flairSelect && initial && typeof initial.had_flair === 'boolean') {
        flairSelect.value = initial.had_flair ? 'yes' : 'no';
      }
      if (skillSelect && initial && typeof initial.achieved_skill === 'boolean') {
        skillSelect.value = initial.achieved_skill ? 'yes' : 'no';
      }

      const removeBtn = item.querySelector('[data-remove]');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          item.remove();
          updateCount();
          toggleEmptyState();
        });
      }

      setupPicker(item, initial);

      itemsContainer.appendChild(fragment);
      updateCount();
      toggleEmptyState();
    }

    function setupPicker(item, initial) {
      const searchInput = item.querySelector('[data-field="sport_label"]');
      const hiddenInput = item.querySelector('[data-field="sport_subcategory_id"]');
      const resultsEl = item.querySelector('[data-search-results]');
      if (!searchInput || !hiddenInput || !resultsEl) return;

      function selectRow(row) {
        hiddenInput.value = row.id;
        searchInput.value = row.label;
        resultsEl.hidden = true;
        resultsEl.innerHTML = '';
      }

      function renderMatches(query) {
        if (!catalog || !catalog.length) return;
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
          option.className = 'past-sport-picker__option';
          option.textContent = row.label;
          option.addEventListener('click', () => {
            selectRow(row);
          });
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
      searchInput.addEventListener('focus', () => {
        renderMatches(searchInput.value);
      });
      searchInput.addEventListener('blur', () => {
        setTimeout(() => {
          resultsEl.hidden = true;
        }, 120);
      });

      resultsEl.addEventListener('pointerdown', (event) => {
        event.preventDefault();
      });

      pickers.add({
        root: item,
        hide() {
          resultsEl.hidden = true;
        },
      });

      if (initial && initial.sport_subcategory_id) {
        const row = catalog ? catalog.find((entry) => entry.id === initial.sport_subcategory_id) : null;
        if (row) {
          selectRow(row);
        }
      }
    }

    function collect() {
      if (!active) {
        return { data: [], errors: [] };
      }
      const items = itemsContainer ? Array.from(itemsContainer.querySelectorAll('[data-item]')) : [];
      const errors = [];
      const payload = [];

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
        const hasOtherValues = Boolean(
          sportLabel ||
            (yearsInput && yearsInput.value) ||
            (ageInput && ageInput.value) ||
            (intensitySelect && intensitySelect.value)
        );

        if (!sportId) {
          if (hasOtherValues) {
            errors.push(`Past sport ${index + 1}: choose a sport from the list.`);
          }
          return;
        }

        const entry = {
          sport_subcategory_id: sportId,
        };

        if (yearsInput && yearsInput.value) {
          const parsedYears = parseFloat(yearsInput.value);
          if (!Number.isNaN(parsedYears) && parsedYears >= 0 && parsedYears <= 80) {
            entry.years_played = parsedYears;
          } else {
            errors.push(`Past sport ${index + 1}: enter years played between 0 and 80.`);
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
          if (INTENSITY_VALUES.includes(value)) {
            entry.intensity = value;
          } else {
            errors.push(`Past sport ${index + 1}: select a valid intensity.`);
          }
        }

        const likedValue = likedSelect ? likedSelect.value : '';
        const flairValue = flairSelect ? flairSelect.value : '';
        const skillValue = skillSelect ? skillSelect.value : '';

        const likedBool = mapSelectToBool(likedValue);
        const flairBool = mapSelectToBool(flairValue);
        const skillBool = mapSelectToBool(skillValue);

        if (likedBool !== null) entry.liked = likedBool;
        if (flairBool !== null) entry.had_flair = flairBool;
        if (skillBool !== null) entry.achieved_skill = skillBool;

        payload.push(entry);
      });

      return { data: payload, errors };
    }

    function applyPrefill() {
      if (!active || !catalog || !catalog.length || !itemsContainer) return;
      if (itemsContainer.querySelector('[data-item]')) return;
      const samples = catalog.slice(0, Math.min(2, catalog.length));
      samples.forEach((row, idx) => {
        addItem({
          sport_subcategory_id: row.id,
          years_played: idx === 0 ? 4 : 2,
          age_started_years: idx === 0 ? 12 : 18,
          intensity: idx === 0 ? 'intense' : 'moderate',
          liked: true,
          had_flair: idx === 0,
          achieved_skill: idx === 0,
        });
      });
    }

    async function update(snapshot) {
      const client = typeof getClient === 'function' ? getClient() : null;
      const userId = snapshot && snapshot.user ? snapshot.user.id : null;
      const currentToken = ++updateToken;

      if (!client || !userId) {
        setLoggedOutState();
        return;
      }

      try {
        await ensureCatalog(client);
      } catch (error) {
        console.error('Failed to load sport catalog', error);
        setLoggedOutState();
        return;
      }

      if (currentToken !== updateToken) return;

      setActiveState();

      let existing = [];
      try {
        existing = await fetchExisting(client, userId);
      } catch (error) {
        console.error('Failed to load past sports', error);
      }

      if (currentToken !== updateToken) return;

      clearItems();
      if (existing && existing.length) {
        existing.forEach((row) => addItem(row));
      } else if (prefillRequested) {
        applyPrefill();
      }
      updateCount();
      toggleEmptyState();
    }

    function prefillForTest() {
      prefillRequested = true;
      if (active && catalog && catalog.length) {
        clearItems();
        applyPrefill();
        updateCount();
        toggleEmptyState();
      }
    }

    return {
      update,
      collect,
      prefillForTest,
    };
  }

  function mapSelectToBool(value) {
    if (!value) return null;
    if (value === 'yes') return true;
    if (value === 'no') return false;
    return null;
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

    if (pastSportsController && typeof pastSportsController.prefillForTest === 'function') {
      pastSportsController.prefillForTest();
    }

    document.querySelectorAll('[data-pair-input]').forEach((input) => {
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
})();
