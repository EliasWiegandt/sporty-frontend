(function () {
  const form = document.querySelector('[data-intake-form]');
  const statusEl = document.querySelector('[data-status]');
  const stepperEl = document.querySelector('[data-hs-stepper]');
  const backBtn = document.querySelector('[data-hs-stepper-back-btn]');
  const nextBtn = document.querySelector('[data-hs-stepper-next-btn]');
  const submitBtn = document.querySelector('[data-stepper-actions] [data-submit]');
  const actionsContainer = document.querySelector('[data-stepper-actions]');
  const bannerTextEl = document.querySelector('[data-intake-banner]');
  const premiumBlock = document.querySelector('[data-premium-block]');
  const premiumLocked = document.querySelector('[data-premium-locked]');
  const premiumLockedMessage = premiumLocked
    ? premiumLocked.querySelector('[data-premium-locked-message]')
    : null;
  const premiumSummaryEl = document.querySelector('[data-premium-summary]');
  const pastSportsSection = document.querySelector('[data-past-sports]');
  const stickyBar = null;
  const stickyButton = null;
  const sportyApp = window.SportyApp;
  let sportySnapshot = { user: null, hasConsent: false };
  let currentStepIndex = 1;
  const STORAGE_KEY = 'sporty:intake:draft:v1';
  let pendingStep = null;
  let isRestoringDraft = false;
  let navTargetStep = null;
  let hasInputNumberListener = false;
  let hasComboListener = false;
  const TOTAL_STEPS = (() => {
    if (!stepperEl) return 3;
    const navItems = stepperEl.querySelectorAll('[data-hs-stepper-nav-item]');
    return navItems.length || 3;
  })();
  const measurementConfig = (() => {
    if (!form || !form.dataset.measurements) return [];
    try {
      return JSON.parse(form.dataset.measurements);
    } catch (error) {
      console.warn('Failed to parse measurement config', error);
      return [];
    }
  })();

  const SEX_OPTIONS = new Set(['female', 'male', 'other', 'prefer_not_to_say']);

  const MEASUREMENT_FIELDS = measurementConfig.length
    ? measurementConfig.map((field) => ({
        name: field.id || field.name,
        label: field.label || field.id,
        unit: field.unit,
        min: typeof field.min === 'number' ? field.min : undefined,
        max: typeof field.max === 'number' ? field.max : undefined,
        step: typeof field.step === 'number' ? field.step : 1,
      }))
    : [
        { name: 'height_cm', label: 'Height (cm)', step: 1 },
        { name: 'weight_kg', label: 'Weight (kg)', step: 0.5 },
        { name: 'arm_span_cm', label: 'Arm span (cm)', step: 1 },
        { name: 'leg_inseam_cm', label: 'Leg inseam (cm)', step: 1 },
        { name: 'shoulder_width_cm', label: 'Shoulder width (cm)', step: 0.5 },
        { name: 'hip_width_cm', label: 'Hip width (cm)', step: 0.5 },
        { name: 'hand_length_cm', label: 'Hand length (cm)', step: 0.5 },
        { name: 'foot_length_cm', label: 'Foot length (cm)', step: 0.5 },
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
    onChange: () => {
      if (!isRestoringDraft) {
        saveDraft();
      }
    },
  });

  if (stickyBar) {
    stickyBar.hidden = true;
  }

  initializeSticky();

  if (!form) {
    updateBanner(sportySnapshot);
    premiumController.update(sportySnapshot);
    pastSportsController.update(sportySnapshot);
    return;
  }
  const draftState = restoreDraft();
  setupStepperGuards();
  setupStepperNavShortcuts();
  initializeMeasurementControls();
  if (draftState && typeof draftState.step === 'number' && draftState.step > 1) {
    applyPendingStep(draftState.step);
  }

  if (form) {
    const handleDraftSave = () => {
      if (isRestoringDraft) return;
      saveDraft();
    };
    form.addEventListener('input', handleDraftSave);
    form.addEventListener('change', handleDraftSave);
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
        ? 'Measurements and results save to your account automatically.'
        : 'Sign in detected: enable data-retention consent in your profile to store future results.';
    } else {
      bannerTextEl.textContent = 'Share measurements for instant sport matches. Log in to save runs for later.';
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

  function setupStepperGuards() {
    if (!stepperEl) return;

    const activeNav = stepperEl.querySelector('[data-hs-stepper-nav-item].active');
    if (activeNav) {
      const attr = activeNav.getAttribute('data-hs-stepper-nav-item');
      try {
        const parsed = attr ? JSON.parse(attr) : null;
        if (parsed && typeof parsed.index === 'number') {
          currentStepIndex = parsed.index;
          updateStepperNavState();
        }
      } catch (_) {
        currentStepIndex = 1;
        updateStepperNavState();
      }
    }

    stepperEl.addEventListener('active.hs.stepper', (event) => {
      if (event && event.detail && typeof event.detail.payload === 'number') {
        currentStepIndex = event.detail.payload;
      }
      setStatus('');
      updateStepperNavState();
      if (!isRestoringDraft) {
        saveDraft();
      }
      progressNavTarget();
    });

    stepperEl.addEventListener('beforeStepChange.hs.stepper', (event) => {
      const { index: nextIndex, isNext } = event.detail || {};
      if (!isNext) return;
      if (!shouldAdvance(currentStepIndex)) {
        event.preventDefault();
        navTargetStep = null;
      }
    });

    stepperEl.addEventListener('back.hs.stepper', () => {
      setStatus('');
      updateStepperNavState();
      if (navTargetStep && navTargetStep > currentStepIndex) {
        navTargetStep = null;
      }
    });

    updateStepperNavState();
  }

  function shouldAdvance(stepIndex) {
    if (!form) return true;
    const fd = new FormData(form);
    if (stepIndex === 1) {
      const basicsResult = validateBasics(fd);
      if (basicsResult.errors.length) {
        const { message, element } = basicsResult.errors[0];
        setStatus(message, 'error');
        focusField(element);
        return false;
      }
      setStatus('');
      return true;
    }

    if (stepIndex === 2) {
      const measurementResult = validateMeasurements(fd);
      if (measurementResult.errors.length) {
        const { message, element } = measurementResult.errors[0];
        setStatus(message, 'error');
        focusField(element);
        return false;
      }
      setStatus('');
      return true;
    }

    return true;
  }

  function updateStepperNavState() {
    const isFirstStep = currentStepIndex <= 1;
    const isFinalStep = currentStepIndex >= TOTAL_STEPS;

    if (backBtn) {
      backBtn.hidden = isFirstStep;
      backBtn.setAttribute('aria-hidden', isFirstStep ? 'true' : 'false');
      backBtn.disabled = isFirstStep;
    }

    if (nextBtn) {
      nextBtn.hidden = isFinalStep;
      nextBtn.setAttribute('aria-hidden', isFinalStep ? 'true' : 'false');
      nextBtn.disabled = isFinalStep;
    }

    if (submitBtn) {
      submitBtn.hidden = !isFinalStep;
      submitBtn.setAttribute('aria-hidden', !isFinalStep ? 'true' : 'false');
      submitBtn.disabled = !isFinalStep;
    }

    if (actionsContainer) {
      actionsContainer.classList.toggle('justify-between', !isFirstStep);
      actionsContainer.classList.toggle('justify-end', isFirstStep);
    }

  }

  function setupStepperNavShortcuts() {
    if (!stepperEl) return;
    const navButtons = stepperEl.querySelectorAll('[data-hs-stepper-nav-item]');
    navButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        const attr = button.getAttribute('data-hs-stepper-nav-item');
        let targetIndex = null;
        try {
          const parsed = attr ? JSON.parse(attr) : null;
          if (parsed && typeof parsed.index !== 'undefined') {
            const parsedIndex = Number(parsed.index);
            if (Number.isFinite(parsedIndex)) {
              targetIndex = parsedIndex;
            }
          }
        } catch (error) {
          targetIndex = null;
        }
        if (!targetIndex || targetIndex < 1 || targetIndex === currentStepIndex) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        navTargetStep = targetIndex;
        progressNavTarget();
      });
    });
  }

  function getStepperInstance() {
    if (!stepperEl) return null;
    if (!window.HSStepper || typeof window.HSStepper.getInstance !== 'function') {
      return null;
    }
    return window.HSStepper.getInstance(stepperEl, true);
  }

  function progressNavTarget() {
    if (!navTargetStep || navTargetStep === currentStepIndex) {
      navTargetStep = null;
      return;
    }

    const instance = getStepperInstance();
    const movingForward = navTargetStep > currentStepIndex;

    if (movingForward) {
      if (instance && typeof instance.goToNext === 'function') {
        instance.goToNext();
        return;
      }
      const nextButton = stepperEl.querySelector('[data-hs-stepper-next-btn]');
      if (nextButton) {
        nextButton.click();
        return;
      }
      navTargetStep = null;
      return;
    }

    if (navTargetStep < currentStepIndex) {
      if (instance && typeof instance.goToPrev === 'function') {
        instance.goToPrev();
        return;
      }
      if (instance && typeof instance.goTo === 'function') {
        instance.goTo(navTargetStep);
        return;
      }
      const backButton = stepperEl.querySelector('[data-hs-stepper-back-btn]');
      if (backButton) {
        backButton.click();
        return;
      }
      navTargetStep = null;
    }
  }

  function focusField(element) {
    if (!element) return;
    if (typeof element.focus === 'function') {
      try {
        element.focus({ preventScroll: true });
      } catch (_) {
        element.focus();
      }
    }
    if (typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  if (typeof element.reportValidity === 'function') {
    element.reportValidity();
  }
}

  function restoreDraft() {
    if (!form || !supportsStorage()) return null;
    let raw = null;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      console.warn('Unable to access intake draft storage', error);
      return null;
    }
    if (!raw) return null;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      console.warn('Failed to parse intake draft', error);
      return null;
    }

    let basics = parsed && parsed.basics ? { ...parsed.basics } : null;
    let measurements = parsed && parsed.measurements ? { ...parsed.measurements } : null;
    let pastSportsDraft = Array.isArray(parsed && parsed.pastSports) ? parsed.pastSports : [];

    const legacyFields = parsed && parsed.fields;
    if (legacyFields && typeof legacyFields === 'object') {
      basics = basics || {};
      if (legacyFields.birthday) basics.birthday = legacyFields.birthday;
      if (legacyFields.sex) basics.sex = legacyFields.sex;

      measurements = measurements || {};
      MEASUREMENT_FIELDS.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(legacyFields, field.name)) {
          measurements[field.name] = legacyFields[field.name];
        }
      });

      if (!pastSportsDraft.length && Array.isArray(legacyFields.past_sports)) {
        pastSportsDraft = legacyFields.past_sports;
      }
    }

    basics = basics || {};
    measurements = measurements || {};

    isRestoringDraft = true;

    try {
      if (basics && basics.birthday) {
        const birthdayInput = form.querySelector('input[name="birthday"]');
        if (birthdayInput) {
          birthdayInput.value = basics.birthday;
        }
      }

      const sexInputRestore = form.querySelector('input[name="sex"][data-hs-combo-box-input]');
      if (basics && basics.sex) {
        if (sexInputRestore instanceof HTMLInputElement) {
          sexInputRestore.value = basics.sex;
          const combo = sexInputRestore.closest('.hs-combo-box');
          setComboValue(combo, basics.sex);
        }
      } else if (sexInputRestore instanceof HTMLInputElement) {
        const combo = sexInputRestore.closest('.hs-combo-box');
        setComboValue(combo, '');
      }

      MEASUREMENT_FIELDS.forEach((field) => {
        if (!Object.prototype.hasOwnProperty.call(measurements, field.name)) return;
        const value = measurements[field.name];
        const input = form.querySelector(`input[name="${field.name}"]`);
        if (!input) return;
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });

      if (pastSportsDraft.length && pastSportsController && typeof pastSportsController.restoreDraft === 'function') {
        pastSportsController.restoreDraft(pastSportsDraft);
      }

      if (typeof parsed.step === 'number' && parsed.step > 1) {
        pendingStep = parsed.step;
      }
    } finally {
      setTimeout(() => {
        isRestoringDraft = false;
        saveDraft();
      }, 0);
    }

    return { step: parsed.step, pastSports: pastSportsDraft };
  }

  function saveDraft() {
    if (!form || !supportsStorage()) return;

    const draft = {
      step: currentStepIndex,
      basics: {},
      measurements: {},
      pastSports: [],
    };

    const birthdayInput = form.querySelector('input[name="birthday"]');
    if (birthdayInput && birthdayInput.value) {
      draft.basics.birthday = birthdayInput.value;
    }

    const sexInputDraft = form.querySelector('input[name="sex"][data-hs-combo-box-input]');
    if (sexInputDraft && sexInputDraft.value) {
      draft.basics.sex = sexInputDraft.value;
    }

    MEASUREMENT_FIELDS.forEach((field) => {
      const input = form.querySelector(`input[name="${field.name}"]`);
      if (!input || !input.value) return;
      draft.measurements[field.name] = input.value;
    });

    if (pastSportsController && typeof pastSportsController.toDraft === 'function') {
      const draftPastSports = pastSportsController.toDraft();
      if (Array.isArray(draftPastSports) && draftPastSports.length) {
        draft.pastSports = draftPastSports;
      }
    }

    const hasBasics = draft.basics && (draft.basics.birthday || draft.basics.sex);
    const hasMeasurements = draft.measurements && Object.keys(draft.measurements).length > 0;
    const hasPast = Array.isArray(draft.pastSports) && draft.pastSports.length > 0;

    try {
      if (hasBasics || hasMeasurements || hasPast) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.warn('Failed to persist intake draft', error);
    }
  }

  function applyPendingStep(step) {
    if (!stepperEl || typeof step !== 'number' || step <= 1) return;

    const advance = () => {
      if (!window.HSStepper || typeof window.HSStepper.getInstance !== 'function') {
        setTimeout(advance, 50);
        return;
      }

      const instance = window.HSStepper.getInstance(stepperEl, true);
      if (!instance || typeof instance.goToNext !== 'function') {
        setTimeout(advance, 50);
        return;
      }

      for (let index = 1; index < step; index += 1) {
        instance.goToNext();
      }
      pendingStep = null;
    };

    advance();
  }

  function supportsStorage() {
    try {
      const key = '__sporty_intake_test__';
      window.localStorage.setItem(key, '1');
      window.localStorage.removeItem(key);
      return true;
    } catch (_) {
      return false;
    }
  }

  function initializeMeasurementControls() {
    if (typeof window !== 'undefined') {
      window.HSStaticMethods?.autoInit?.();
      if (!hasInputNumberListener) {
        document.addEventListener('change.hs.inputNumber', handleInputNumberChange);
        hasInputNumberListener = true;
      }
      if (!hasComboListener) {
        document.addEventListener('select.hs.combobox', handleComboSelect);
        hasComboListener = true;
      }
      initializeComboDefaults(form);
      normalizeInputNumberInitial(form);
    }
  }

  function handleInputNumberChange(event) {
    const target = event.target instanceof Element ? event.target : null;
    const container = target ? target.closest('[data-hs-input-number]') : null;
    if (!container) return;
    const input = container.querySelector('[data-hs-input-number-input]');
    if (!(input instanceof HTMLInputElement)) return;
    if (
      input.dataset.allowEmpty === 'true' &&
      input.value === '0' &&
      input.dataset.allowEmptyInitialized !== 'true'
    ) {
      input.value = '';
      input.dataset.allowEmptyInitialized = 'true';
    } else if (input.dataset.allowEmpty === 'true' && input.value !== '') {
      input.dataset.allowEmptyInitialized = 'true';
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    setStatus('');
  }

  function handleComboSelect(event) {
    const target = event.target instanceof Element ? event.target : null;
    const combo = target ? target.closest('.hs-combo-box') : null;
    if (!combo) return;
    const input = combo.querySelector('[data-hs-combo-box-input]');
    const value = input instanceof HTMLInputElement ? input.value : '';
    setComboValue(combo, value);
    if (!isRestoringDraft) {
      saveDraft();
    }
  }

  function normalizeInputNumberInitial(scope) {
    const context = scope || document;
    const inputs = context.querySelectorAll('[data-hs-input-number-input][data-allow-empty="true"]');
    inputs.forEach((input) => {
      if (!(input instanceof HTMLInputElement)) return;
      if (input.dataset.allowEmptyInitialized === 'true') return;
      if (input.value === '0') {
        input.value = '';
      }
      input.dataset.allowEmptyInitialized = 'true';
    });
  }

  function initializeComboDefaults(scope) {
    const context = scope || document;
    const combos = context.querySelectorAll('.hs-combo-box');
    combos.forEach((combo) => {
      const input = combo.querySelector('[data-hs-combo-box-input]');
      const value = input instanceof HTMLInputElement ? input.value : '';
      setComboValue(combo, value);
    });
  }

  function setComboValue(comboEl, value) {
    if (!comboEl) return;
    const input = comboEl.querySelector('[data-hs-combo-box-input]');
    if (input instanceof HTMLInputElement) {
      input.value = value || '';
    }
    const items = comboEl.querySelectorAll('[data-hs-combo-box-output-item]');
    let labelText = '';
    items.forEach((item) => {
      const valueEl = item.querySelector('[data-hs-combo-box-value]');
      const matches = Boolean(value && valueEl && valueEl.textContent === value);
      item.classList.toggle('selected', matches);
      if (matches) {
        const textEl = item.querySelector('[data-hs-combo-box-search-text]');
        labelText = textEl ? textEl.textContent || '' : '';
      }
    });
    const labelEl = comboEl.querySelector('[data-hs-combo-box-deselect-value]');
    if (labelEl) {
      const defaultLabel = labelEl.getAttribute('data-default-label') || labelEl.textContent || 'Select';
      labelEl.textContent = labelText || defaultLabel;
    }
    comboEl.classList.toggle('has-value', Boolean(value));
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!submitBtn) return;

    if (typeof form.reportValidity === 'function' && !form.reportValidity()) {
      return;
    }

    const fd = new FormData(form);
    const basicsResult = validateBasics(fd);
    if (basicsResult.errors.length) {
      const { message, element } = basicsResult.errors[0];
      setStatus(message, 'error');
      focusField(element);
      return;
    }

    const measurementResult = validateMeasurements(fd);
    if (measurementResult.errors.length) {
      const { message, element } = measurementResult.errors[0];
      setStatus(message, 'error');
      focusField(element);
      return;
    }

    const premiumSelection = premiumController.collect() || {
      applyCredit: false,
      data: null,
      errors: [],
    };
    if (premiumSelection.errors && premiumSelection.errors.length) {
      setStatus(premiumSelection.errors.join(' '), 'error');
      return;
    }

    const usePremium = Boolean(premiumSelection.applyCredit);
    const premiumData = premiumSelection.data || null;

    if (usePremium && (!sportySnapshot.user || !sportySnapshot.user.id)) {
      setStatus('Sign in to apply an adult analysis credit.', 'error');
      return;
    }

    const pastSportsSelection = pastSportsController.collect();
    if (pastSportsSelection && pastSportsSelection.errors && pastSportsSelection.errors.length) {
      setStatus(pastSportsSelection.errors.join(' '), 'error');
      return;
    }

    const payload = buildSubmissionPayload({
      basics: basicsResult.data,
      measurements: measurementResult.data,
      pastSports: pastSportsSelection ? pastSportsSelection.data : [],
      usePremium,
      premiumData,
      userId: sportySnapshot.user && sportySnapshot.user.id ? sportySnapshot.user.id : null,
    });

    setSubmitBusy(true);
    setStatus(
      usePremium ? 'Applying your credit and crunching the numbers…' : 'Crunching the numbers…',
      'info'
    );

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
      const endpoint = usePremium ? '/api/recommend-adult-premium' : '/api/recommend-adult-free';
      const response = await fetch(endpoint, {
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

      const resultJson = (() => {
        try {
          return JSON.parse(bodyText);
        } catch (_) {
          return null;
        }
      })();

      const storageKey = usePremium ? 'sporty:lastPremiumResult' : 'sporty:lastResult';
      sessionStorage.setItem(storageKey, bodyText);
      if (!usePremium) {
        sessionStorage.setItem('sporty:lastResult', bodyText);
      } else if (resultJson && resultJson.credit && resultJson.credit.totals) {
        sessionStorage.setItem('sporty:lastCreditSnapshot', JSON.stringify(resultJson.credit.totals));
      }

      if (consentAccepted && sportyApp && typeof sportyApp.saveRecommendation === 'function') {
        try {
          const extraPayload = {};
          if (premiumData) {
            extraPayload.analysisInput = premiumData;
          }
          if (pastSportsSelection && Array.isArray(pastSportsSelection.data) && pastSportsSelection.data.length) {
            extraPayload.pastSports = pastSportsSelection.data.map(({ sport_label, ...rest }) => rest);
          }
          extraPayload.analysisType = usePremium ? 'premium' : 'free';
          const extras = Object.keys(extraPayload).length ? extraPayload : undefined;
          if (!resultJson) throw new Error('Invalid analysis payload');
          const saveOutcome = await sportyApp.saveRecommendation(payload, resultJson, extras);
          if (saveOutcome && saveOutcome.saved) {
            setStatus('Saved to your account. Redirecting…', 'info');
          }
        } catch (error) {
          console.error('Failed to persist recommendation', error);
        }
      }

      window.location.assign(usePremium ? '/results/premium' : '/results');
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
  }

  function initializeSticky() {}

  function validateBasics(fd) {
    const errors = [];
    const birthday = (fd.get('birthday') || '').toString().trim();
    const sex = (fd.get('sex') || '').toString().trim();
    const birthdayInput = form ? form.querySelector('input[name="birthday"]') : null;
    const sexInputEl = form ? form.querySelector('input[name="sex"][data-hs-combo-box-input]') : null;
    const sexToggleEl = form ? form.querySelector('[data-combo-toggle="sex"]') : null;

    if (!birthday) {
      errors.push({
        field: 'birthday',
        message: 'Add your birthday before continuing.',
        element: birthdayInput,
      });
    }

    if (!sex || !SEX_OPTIONS.has(sex)) {
      errors.push({
        field: 'sex',
        message: 'Select the sex assigned at birth before continuing.',
        element: sexToggleEl,
      });
    }

    return {
      data: {
        birthday,
        sex,
      },
      errors,
    };
  }

  function validateMeasurements(fd) {
    const errors = [];
    const measurements = {};

    MEASUREMENT_FIELDS.forEach((field) => {
      const input = form ? form.querySelector(`input[name="${field.name}"]`) : null;
      const raw = fd.get(field.name);
      const valueStr = raw != null ? raw.toString().trim() : '';
      const label = field.label || field.name;

      if (!valueStr) {
        errors.push({
          field: field.name,
          message: `Enter ${label.toLowerCase()} before continuing.`,
          element: input,
        });
        return;
      }

      const valueNum = Number(valueStr);
      if (!Number.isFinite(valueNum)) {
        errors.push({
          field: field.name,
          message: `${label} must be a number.`,
          element: input,
        });
        return;
      }

      if (typeof field.min === 'number' && valueNum < field.min) {
        errors.push({
          field: field.name,
          message: `${label} must be at least ${field.min}.`,
          element: input,
        });
        return;
      }

      if (typeof field.max === 'number' && valueNum > field.max) {
        errors.push({
          field: field.name,
          message: `${label} must be at most ${field.max}.`,
          element: input,
        });
        return;
      }

      measurements[field.name] = valueNum;
    });

    return { data: measurements, errors };
  }

  function sanitizePremiumData(raw) {
    const toArray = (value) => (Array.isArray(value) ? value : []);
    if (!raw) {
      return {
        preferences: [],
        goals: [],
        injuries: [],
      };
    }

    return {
      preferences: toArray(raw.preferences),
      goals: toArray(raw.goals),
      injuries: toArray(raw.injuries),
    };
  }

  function buildSubmissionPayload({ basics, measurements, pastSports, usePremium, premiumData, userId }) {
    const payload = {
      birthday: basics.birthday,
      sex: basics.sex || 'prefer_not_to_say',
      ...measurements,
    };

    if (!usePremium) {
      payload.consent_preview = true;
    }

    if (pastSports && pastSports.length) {
      payload.past_sports = pastSports.map((entry) => {
        const { sport_label, ...rest } = entry || {};
        return rest;
      });
    }

    if (usePremium) {
      const sanitizedPremium = sanitizePremiumData(premiumData);
      if (userId) {
        payload.user_id = userId;
      }
      payload.premium = {
        apply_credit: true,
        preferences: sanitizedPremium.preferences,
        goals: sanitizedPremium.goals,
        injuries: sanitizedPremium.injuries,
      };
      delete payload.consent_preview;
    }

    return payload;
  }

  function createPastSportsController(config) {
    const { root, getClient, onChange } = config || {};
    const MAX_ITEMS = 5;
    const INTENSITY_VALUES = ['light', 'moderate', 'intense', 'elite'];
    if (!root) {
      return {
        update: async () => {},
        collect: () => ({ data: [], errors: [] }),
        prefillForTest: () => {},
        restoreDraft: () => {},
        toDraft: () => [],
        isActive: () => false,
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
    const changeCallback = typeof onChange === 'function' ? onChange : () => {};
    let suppressChange = false;
    let changeScheduled = false;
    let draftBuffer = null;
    let localDraftApplied = false;

    document.addEventListener('click', (event) => {
      pickers.forEach((picker) => {
        if (!picker.root.contains(event.target)) {
          picker.hide();
        }
      });
    });

    const scheduleDraftChange = () => {
      if (suppressChange || changeScheduled || isRestoringDraft) return;
      changeScheduled = true;
      Promise.resolve().then(() => {
        changeScheduled = false;
        if (!suppressChange && !isRestoringDraft) {
          changeCallback();
        }
      });
    };

    if (addButton) {
      addButton.addEventListener('click', () => {
        if (!active) return;
        if (itemsContainer && itemsContainer.querySelectorAll('[data-item]').length >= MAX_ITEMS) {
          return;
        }
        addItem();
        scheduleDraftChange();
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
          emptyState.textContent =
            message ||
            'Add the sports and disciplines you’ve spent time in. These influence both free and premium matches.';
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

    function clearItems(notify = true) {
      if (itemsContainer) {
        itemsContainer.innerHTML = '';
      }
      pickers.clear();
      updateCount();
      if (notify) scheduleDraftChange();
    }

    function setActiveState() {
      if (active) return;
      active = true;
      toggleEmptyState();
      if (draftBuffer && draftBuffer.length) {
        applyDraftEntries(draftBuffer);
        draftBuffer = null;
      } else if (itemsContainer && !itemsContainer.querySelector('[data-item]')) {
        addItem();
      }
    }

    function applyDraftEntries(entries) {
      if (!entries || !Array.isArray(entries)) return;
      suppressChange = true;
      clearItems(false);
      entries.forEach((entry) => addItem(entry));
      updateCount();
      toggleEmptyState();
      localDraftApplied = true;
      suppressChange = false;
      scheduleDraftChange();
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
      })()
        .catch((error) => {
          console.error('Failed to load sport catalog from Supabase', error);
          catalog = [];
          return catalog;
        })
        .finally(() => {
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
      const intensityInput = item.querySelector('[data-field="intensity"]');
      const likedSelect = item.querySelector('[data-field="liked"]');
      const flairSelect = item.querySelector('[data-field="had_flair"]');
      const skillSelect = item.querySelector('[data-field="achieved_skill"]');

      if (yearsInput && initial && typeof initial.years_played !== 'undefined' && initial.years_played !== null) {
        yearsInput.value = Number(initial.years_played);
      }
      if (ageInput && initial && typeof initial.age_started_years !== 'undefined' && initial.age_started_years !== null) {
        ageInput.value = Number(initial.age_started_years);
      }
      if (intensityInput && initial && initial.intensity && INTENSITY_VALUES.includes(initial.intensity)) {
        intensityInput.value = initial.intensity;
        const combo = intensityInput.closest('.hs-combo-box');
        setComboValue(combo, initial.intensity);
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

      const registerChange = (element) => {
        if (!element) return;
        element.addEventListener('input', scheduleDraftChange);
        element.addEventListener('change', scheduleDraftChange);
      };

      registerChange(yearsInput);
      registerChange(ageInput);
      registerChange(intensityInput);
      registerChange(likedSelect);
      registerChange(flairSelect);
      registerChange(skillSelect);

      const removeBtn = item.querySelector('[data-remove]');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          item.remove();
          updateCount();
          toggleEmptyState();
          scheduleDraftChange();
        });
      }

      setupPicker(item, initial);

      if (!initial && itemsContainer.firstChild) {
        itemsContainer.insertBefore(fragment, itemsContainer.firstChild);
      } else {
        itemsContainer.appendChild(fragment);
      }
      if (!initial) {
        const searchInput = item.querySelector('[data-field="sport_label"]');
        if (searchInput instanceof HTMLInputElement) {
          searchInput.focus();
        }
        const intensityCombo = item.querySelector('.hs-combo-box[data-hs-combo-box]');
        if (intensityCombo) {
          setComboValue(intensityCombo, '');
        }
      }
      updateCount();
      toggleEmptyState();
      scheduleDraftChange();
      if (typeof window !== 'undefined') {
        window.HSStaticMethods?.autoInit?.();
      }
      initializeComboDefaults(item);
      normalizeInputNumberInitial(item);
    }

    function setupPicker(item, initial) {
      const searchInput = item.querySelector('[data-field="sport_label"]');
      const hiddenInput = item.querySelector('[data-field="sport_subcategory_id"]');
      const resultsEl = item.querySelector('[data-search-results]');
      if (!searchInput || !hiddenInput || !resultsEl) return;

      resultsEl.setAttribute('role', 'listbox');
      resultsEl.setAttribute('tabindex', '-1');

      if (initial && initial.sport_subcategory_id && !hiddenInput.value) {
        hiddenInput.value = initial.sport_subcategory_id;
      }

      function selectRow(row) {
        hiddenInput.value = row.id;
        searchInput.value = row.label;
        resultsEl.hidden = true;
        resultsEl.classList.add('hidden');
        resultsEl.innerHTML = '';
        scheduleDraftChange();
      }

      function renderMatches(query) {
        if (!catalog || !catalog.length) return;
        const matches = searchCatalog(query);
        if (!matches.length) {
          resultsEl.hidden = true;
          resultsEl.classList.add('hidden');
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
          option.addEventListener('click', () => {
            selectRow(row);
          });
          fragment.appendChild(option);
        });
        resultsEl.innerHTML = '';
        resultsEl.appendChild(fragment);
        resultsEl.hidden = false;
        resultsEl.classList.remove('hidden');
      }

      searchInput.addEventListener('input', () => {
        hiddenInput.value = '';
        renderMatches(searchInput.value);
        scheduleDraftChange();
      });
      searchInput.addEventListener('focus', () => {
        renderMatches(searchInput.value);
      });
      searchInput.addEventListener('blur', () => {
        setTimeout(() => {
          resultsEl.hidden = true;
          resultsEl.classList.add('hidden');
        }, 120);
      });

      resultsEl.addEventListener('pointerdown', (event) => {
        event.preventDefault();
      });

      pickers.add({
        root: item,
        hide() {
          resultsEl.hidden = true;
          resultsEl.classList.add('hidden');
        },
      });

      if (initial && initial.sport_subcategory_id) {
        const row = catalog ? catalog.find((entry) => entry.id === initial.sport_subcategory_id) : null;
        if (row) {
          selectRow(row);
        }
      }

      if (initial && initial.sport_label && !searchInput.value) {
        searchInput.value = initial.sport_label;
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
        const intensityInput = item.querySelector('[data-field="intensity"]');
        const likedSelect = item.querySelector('[data-field="liked"]');
        const flairSelect = item.querySelector('[data-field="had_flair"]');
        const skillSelect = item.querySelector('[data-field="achieved_skill"]');

        const sportId = hiddenInput && hiddenInput.value ? hiddenInput.value.trim() : '';
        const sportLabel = labelInput && labelInput.value ? labelInput.value.trim() : '';
        const hasOtherValues = Boolean(
          sportLabel ||
            (yearsInput && yearsInput.value) ||
            (ageInput && ageInput.value) ||
            (intensityInput && intensityInput.value)
        );

        if (!sportId) {
          if (hasOtherValues) {
            errors.push(`Past sport ${index + 1}: choose a sport from the list.`);
          }
          return;
        }

        const entry = {
          sport_subcategory_id: sportId,
          sport_label: sportLabel || null,
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

        if (intensityInput && intensityInput.value) {
          const value = intensityInput.value;
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

      const shouldActivate = Boolean(client);
      try {
        await ensureCatalog(client);
      } catch (error) {
        console.error('Failed to load sport catalog', error);
        if (!shouldActivate) {
          active = false;
          toggleEmptyState('Add the sports and disciplines you’ve spent time in. These influence both free and premium matches.');
          return;
        }
        throw error;
      }

      if (currentToken !== updateToken) return;

      setActiveState();

      let existing = [];
      if (client && userId) {
        try {
          existing = await fetchExisting(client, userId);
        } catch (error) {
          console.error('Failed to load past sports', error);
        }
      }

      if (currentToken !== updateToken) return;

      let keepLocal = false;
      if (localDraftApplied) {
        const currentDraft = collect().data;
        keepLocal = Array.isArray(currentDraft) && currentDraft.length > 0;
      }

      suppressChange = true;

      if (keepLocal) {
        suppressChange = false;
        scheduleDraftChange();
        return;
      }

      clearItems(false);
      if (existing && existing.length) {
        existing.forEach((row) => addItem(row));
        localDraftApplied = false;
      } else if (prefillRequested) {
        applyPrefill();
        localDraftApplied = false;
      } else {
        localDraftApplied = false;
      }
      updateCount();
      toggleEmptyState();
      suppressChange = false;
      scheduleDraftChange();
    }

    function prefillForTest() {
      prefillRequested = true;
      if (active && catalog && catalog.length) {
        suppressChange = true;
        clearItems(false);
        applyPrefill();
        updateCount();
        toggleEmptyState();
        localDraftApplied = false;
        suppressChange = false;
        scheduleDraftChange();
      }
    }

    return {
      update,
      collect,
      prefillForTest,
      restoreDraft(entries) {
        if (!entries || !Array.isArray(entries) || !entries.length) {
          draftBuffer = null;
          localDraftApplied = false;
          scheduleDraftChange();
          return;
        }
        draftBuffer = entries.map((entry) => ({ ...entry }));
        if (active) {
          applyDraftEntries(draftBuffer);
          draftBuffer = null;
        }
      },
      toDraft() {
        if (!active) {
          return draftBuffer ? draftBuffer.map((entry) => ({ ...entry })) : [];
        }
        return collect().data.map((entry) => ({ ...entry }));
      },
      isActive() {
        return active;
      },
    };
  }

  function mapSelectToBool(value) {
    if (!value) return null;
    if (value === 'yes') return true;
    if (value === 'no') return false;
    return null;
  }

  function createPremiumController(config) {
    const { block, locked, lockedMessage, summary, getClient } = config || {};
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
    const toggleWrapper = block ? block.querySelector('[data-premium-toggle]') : null;
    const applyToggle = block ? block.querySelector('[data-premium-apply]') : null;
    let active = false;
    let consentGranted = false;
    let creditCount = 0;
    let lastUserId = null;
    let updateToken = 0;
    let applyCredit = false;

    if (applyToggle) {
      applyToggle.addEventListener('change', (event) => {
        applyCredit = Boolean(event.currentTarget.checked);
        updateSummary();
      });
    }

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
      const actionText = applyCredit
        ? 'We will apply one credit when you submit.'
        : 'Toggle below to apply a credit for the detailed analysis.';
      summary.textContent = consentGranted
        ? `${creditText} ${actionText}`
        : `${creditText} Enable data-retention consent when prompted so we can store these detailed inputs.`;
    }

    function activate() {
      active = true;
      if (locked) locked.hidden = true;
      if (block) block.hidden = false;
      if (toggleWrapper) toggleWrapper.hidden = false;
      if (applyToggle) applyToggle.disabled = false;
      updateSummary();
    }

    function deactivate(message) {
      active = false;
      creditCount = 0;
      applyCredit = false;
      if (block) block.hidden = true;
      if (summary) summary.textContent = '';
      if (locked) locked.hidden = false;
      if (lockedMessage) {
        lockedMessage.textContent = message || defaultLockedMessage();
      }
      if (toggleWrapper) toggleWrapper.hidden = true;
      if (applyToggle) {
        applyToggle.checked = false;
        applyToggle.disabled = true;
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

    async function fetchAdultCredits(userId) {
      if (!userId) return { availableCount: 0 };
      const resp = await fetch(`/api/credits?user_id=${encodeURIComponent(userId)}`, {
        headers: { Accept: 'application/json' },
      });
      if (!resp.ok) {
        throw new Error(`Failed to fetch credits (${resp.status})`);
      }
      const payload = await resp.json();
      const availableCount = Number(payload.adult_credits) || 0;
      return { availableCount };
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
        if (toggleWrapper) toggleWrapper.hidden = false;
        if (applyToggle) {
          applyToggle.disabled = false;
          applyToggle.checked = applyCredit;
        }
        activate();
      },
      collect() {
        if (!active) {
          return { applyCredit: false, data: null, errors: [] };
        }
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

        return { applyCredit, data, errors };
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
        const option = state.options.find((opt) => opt.id === value);
        data.push({
          [config.keyField]: value,
          name: option && option.name ? option.name : value,
          description: option && option.description ? option.description : undefined,
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

        const injuryOption = state.injuries.find((injury) => injury.id === injuryId);
        const subOptions = state.subcategories[injuryId] || [];
        const subOption = subOptions.find((sub) => sub.id === subcategoryId);

        data.push({
          injury_id: injuryId,
          injury_name: injuryOption && injuryOption.name ? injuryOption.name : injuryId,
          injury_subcategory_id: subcategoryId || null,
          injury_subcategory_name: subOption && subOption.name ? subOption.name : null,
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

    MEASUREMENT_FIELDS.forEach((field) => {
      const input = form.elements.namedItem(field.name);
      if (input instanceof HTMLInputElement) {
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }
})();
