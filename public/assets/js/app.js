(function () {
  const SUPABASE_JS = window.supabase;
  const CONFIG = window.SPORTY_CONFIG || {};
  const SUPABASE_URL = CONFIG.SUPABASE_URL || window.SUPABASE_URL || '';
  const SUPABASE_KEY =
    CONFIG.SUPABASE_PUBLISHABLE_KEY || window.SUPABASE_PUBLISHABLE_KEY || '';
  const CONSENT_TYPE = 'data_retention';
  const CONSENT_VERSION = 'adult-data-retention-v1';
  const MODEL_VERSION = 'free-adult-v1';
  const PENDING_CONSENT_KEY = 'sporty:pending-consent';

  const state = {
    client: null,
    session: null,
    user: null,
    hasConsent: false,
    listeners: new Set(),
    consentResolvers: [],
    consentModal: null,
    authOverlay: null,
    authMode: 'signin',
    authStatusEl: null,
    readyResolve: null,
  };

  const ready = new Promise((resolve) => {
    state.readyResolve = resolve;
  });

  const api = {
    ready,
    getClient: () => state.client,
    getUser: () => state.user,
    hasConsent: () => state.hasConsent,
    onAuthChange: (callback) => {
      if (typeof callback !== 'function') return () => {};
      state.listeners.add(callback);
      callback(snapshot());
      return () => state.listeners.delete(callback);
    },
    openAuth: () => openAuthOverlay(),
    closeAuth: () => closeAuthOverlay(),
    setAuthMode: (mode) => setAuthMode(mode),
    signOut: () => signOut(),
    ensureConsent: () => ensureConsent(),
    saveRecommendation: (formPayload, resultPayload, extras) =>
      saveRecommendation(formPayload, resultPayload, extras),
    fetchRecommendations: (limit) => fetchRecommendations(limit),
    refreshConsent: () => loadConsent(),
    fetchConsents: () => fetchConsents(),
    revokeConsent: () => revokeConsent(),
  };

  window.SportyApp = api;

  document.addEventListener('DOMContentLoaded', init);

  function snapshot() {
    return {
      session: state.session,
      user: state.user,
      hasConsent: state.hasConsent,
    };
  }

  async function init() {
    setupAuthUI();
    createConsentModal();
    if (!SUPABASE_JS || !SUPABASE_URL || !SUPABASE_KEY) {
      console.warn('[Sporty] Supabase configuration missing; auth disabled.');
      notifyListeners();
      state.readyResolve();
      return;
    }

    state.client = SUPABASE_JS.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'Accept-Profile': 'public',
          'Content-Profile': 'public',
        },
      },
    });

    try {
      const { data, error } = await state.client.auth.getSession();
      if (error) throw error;
      updateSession(data ? data.session : null);
    } catch (error) {
      console.error('[Sporty] Unable to fetch Supabase session', error);
    }

    state.client.auth.onAuthStateChange((_event, session) => {
      updateSession(session);
    });

    notifyListeners();
    state.readyResolve();
  }

  function updateSession(session) {
    state.session = session;
    state.user = session && session.user ? session.user : null;

    updateAuthControls();

    if (state.user) {
      loadConsent();
    } else {
      state.hasConsent = false;
      hideConsentBanner();
      resolveConsentPromises(false);
      notifyListeners();
    }
    if (state.user) {
      notifyListeners();
    }
  }

  function notifyListeners() {
    const snap = snapshot();
    state.listeners.forEach((listener) => {
      try {
        listener(snap);
      } catch (error) {
        console.error('[Sporty] Listener error', error);
      }
    });
  }

  function setupAuthUI() {
    const overlay = document.createElement('div');
    overlay.className = 'auth-overlay';
    overlay.setAttribute('data-auth-overlay', '');
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
        <div class="auth-modal__header">
          <h2 class="auth-modal__title" id="auth-modal-title">Log in</h2>
          <button type="button" class="auth-modal__close" data-auth-close aria-label="Close">&times;</button>
        </div>
        <p class="auth-modal__status" data-auth-status hidden></p>
        <form data-auth-form>
          <label>
            <span>Email</span>
            <input type="email" name="email" required autocomplete="email" />
          </label>
          <label>
            <span>Password</span>
            <input type="password" name="password" required autocomplete="current-password" minlength="6" />
          </label>
          <label class="auth-modal__consent" data-signup-consent-row hidden>
            <input type="checkbox" name="signup-consent" data-signup-consent />
            <span>
              I consent to Sporty storing my measurements and recommendations in line with the
              <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.
            </span>
          </label>
          <div class="auth-modal__actions">
            <button class="btn-primary" type="submit" data-auth-submit>Log in</button>
            <p class="auth-modal__switch">
              <button type="button" data-auth-switch>Need an account? Sign up</button>
            </p>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);
    state.authOverlay = overlay;
    state.authStatusEl = overlay.querySelector('[data-auth-status]');

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        closeAuthOverlay();
      }
    });

    const closeBtn = overlay.querySelector('[data-auth-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => closeAuthOverlay());
    }

    const form = overlay.querySelector('[data-auth-form]');
    if (form) {
      form.addEventListener('submit', handleAuthSubmit);
    }

    const switchBtn = overlay.querySelector('[data-auth-switch]');
    if (switchBtn) {
      switchBtn.addEventListener('click', () => {
        const nextMode = state.authMode === 'signin' ? 'signup' : 'signin';
        setAuthMode(nextMode);
      });
    }

    setAuthMode('signin');
    updateAuthStatus();

    const loginButtons = document.querySelectorAll('[data-auth-open]');
    loginButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const mode = button.dataset.authMode === 'signup' ? 'signup' : 'signin';
        setAuthMode(mode, { preserveStatus: true });
        openAuthOverlay();
      });
    });

    const signOutButtons = document.querySelectorAll('[data-auth-signout]');
    signOutButtons.forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        await signOut();
      });
    });
  }

  function setAuthMode(mode, { preserveStatus = false } = {}) {
    state.authMode = mode === 'signup' ? 'signup' : 'signin';
    const overlay = state.authOverlay;
    if (!overlay) return;
    const title = overlay.querySelector('.auth-modal__title');
    const submit = overlay.querySelector('[data-auth-submit]');
    const switchBtn = overlay.querySelector('[data-auth-switch]');
    const passwordInput = overlay.querySelector('input[name="password"]');
    const consentRow = overlay.querySelector('[data-signup-consent-row]');
    const consentInput = overlay.querySelector('[data-signup-consent]');

    if (state.authMode === 'signin') {
      if (title) title.textContent = 'Log in';
      if (submit) submit.textContent = 'Log in';
      if (switchBtn) switchBtn.textContent = 'Need an account? Sign up';
      if (passwordInput) passwordInput.setAttribute('autocomplete', 'current-password');
      if (consentRow) {
        consentRow.hidden = true;
        if (consentInput) consentInput.checked = false;
      }
    } else {
      if (title) title.textContent = 'Create account';
      if (submit) submit.textContent = 'Sign up';
      if (switchBtn) switchBtn.textContent = 'Already have an account? Log in';
      if (passwordInput) passwordInput.setAttribute('autocomplete', 'new-password');
      if (consentRow) consentRow.hidden = false;
    }

    if (!preserveStatus) {
      updateAuthStatus();
    }
  }

  function openAuthOverlay() {
    if (!state.authOverlay) return;
    state.authOverlay.hidden = false;
    const emailInput = state.authOverlay.querySelector('input[name="email"]');
    if (emailInput) {
      setTimeout(() => emailInput.focus(), 0);
    }
  }

  function closeAuthOverlay() {
    if (!state.authOverlay) return;
    state.authOverlay.hidden = true;
    const form = state.authOverlay.querySelector('[data-auth-form]');
    if (form) form.reset();
    setAuthMode('signin');
    updateAuthStatus();
  }

  function updateAuthStatus(message, variant = 'info') {
    if (!state.authStatusEl) return;
    if (!message) {
      state.authStatusEl.hidden = true;
      state.authStatusEl.textContent = '';
      state.authStatusEl.classList.remove('auth-modal__status--error');
      return;
    }

    state.authStatusEl.hidden = false;
    state.authStatusEl.textContent = message;
    if (variant === 'error') {
      state.authStatusEl.classList.add('auth-modal__status--error');
    } else {
      state.authStatusEl.classList.remove('auth-modal__status--error');
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    if (!state.client) {
      updateAuthStatus('Authentication is unavailable right now.', 'error');
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '');
    const consentChecked = formData.get('signup-consent') === 'on';

    if (!email || !password) {
      updateAuthStatus('Email and password are required.', 'error');
      return;
    }

    if (state.authMode === 'signup' && !consentChecked) {
      updateAuthStatus('Please agree to data retention before creating an account.', 'error');
      return;
    }

    updateAuthStatus('Working…');

    try {
      if (state.authMode === 'signin') {
        const { error } = await state.client.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        updateAuthStatus('Success! Redirecting…', 'info');
        setTimeout(() => closeAuthOverlay(), 400);
      } else {
        const { data, error } = await state.client.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        if (data.user) {
          await handleSignupConsent(data.user, data.session, consentChecked);
          updateAuthStatus('Account created. Check your inbox to verify your email, then log in.', 'info');
          setAuthMode('signin', { preserveStatus: true });
        } else {
          updateAuthStatus('Check your email to finish setting up your account.', 'info');
        }
      }
    } catch (error) {
      updateAuthStatus(error.message || 'Authentication failed.', 'error');
    }
  }

  async function handleSignupConsent(user, session, consentChecked) {
    if (!consentChecked || !user) return;

    const userId = user.id;
    if (!userId) return;

    if (session && session.access_token) {
      try {
        await recordConsentForUser(userId);
        if (state.user && state.user.id === userId) {
          state.hasConsent = true;
          notifyListeners();
        }
        return;
      } catch (error) {
        console.error('[Sporty] Unable to save consent immediately after sign up', error);
      }
    }

    addPendingConsent(userId);
  }

  async function signOut() {
    if (!state.client) return;
    try {
      await state.client.auth.signOut();
    } catch (error) {
      console.error('[Sporty] Sign-out failed', error);
    }
  }

  function updateAuthControls() {
    const controls = document.querySelectorAll('[data-auth-controls]');
    controls.forEach((container) => {
      const openButtons = container.querySelectorAll('[data-auth-open]');
      const signout = container.querySelector('[data-auth-signout]');

      const showSignout = Boolean(state.client && state.user);

      openButtons.forEach((btn) => {
        const shouldShow = !showSignout;
        btn.disabled = !state.client;
        btn.hidden = !shouldShow;
        btn.style.display = shouldShow ? '' : 'none';
      });

      if (signout) {
        signout.disabled = !state.client;
        signout.hidden = !showSignout;
        signout.style.display = showSignout ? '' : 'none';
      }
    });
  }

  async function loadConsent() {
    if (!state.client || !state.user) return;

    try {
      let active = await getActiveConsent(state.user.id);
      if (!active) {
        const applied = await maybeApplyPendingConsent();
        if (applied) {
          active = await getActiveConsent(state.user.id);
        }
      }

      state.hasConsent = Boolean(active);
      if (!state.hasConsent) {
        resolveConsentPromises(false);
      }

      notifyListeners();
    } catch (error) {
      console.error('[Sporty] Failed to load consent', error);
    }
  }

  function ensureConsent() {
    if (!state.client || !state.user) return Promise.resolve(false);
    if (state.hasConsent) return Promise.resolve(true);

    openConsentModal();

    return new Promise((resolve) => {
      state.consentResolvers.push(resolve);
    });
  }

  function createConsentModal() {
    if (state.consentModal) return;

    const overlay = document.createElement('div');
    overlay.className = 'auth-overlay';
    overlay.setAttribute('data-consent-overlay', '');
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="consent-modal" role="dialog" aria-modal="true" aria-labelledby="consent-modal-title">
        <h2 id="consent-modal-title">Allow Sporty to store your results?</h2>
        <p>We only save your measurements and recommendations after you consent. You can revoke this later from your profile.</p>
        <div class="consent-modal__actions">
          <button type="button" class="btn-ghost" data-consent-decline>Not now</button>
          <button type="button" class="btn-primary" data-consent-confirm>Allow storage</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const confirmBtn = overlay.querySelector('[data-consent-confirm]');
    const declineBtn = overlay.querySelector('[data-consent-decline]');

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        overlay.hidden = true;
        resolveConsentPromises(false);
      }
    });

    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        if (!state.client || !state.user) {
          overlay.hidden = true;
          resolveConsentPromises(false);
          return;
        }
        confirmBtn.disabled = true;
        try {
          await recordConsentForUser(state.user.id);
          state.hasConsent = true;
          overlay.hidden = true;
          notifyListeners();
          resolveConsentPromises(true);
        } catch (error) {
          console.error('[Sporty] Failed to record consent', error);
          confirmBtn.disabled = false;
        }
      });
    }

    if (declineBtn) {
      declineBtn.addEventListener('click', () => {
        overlay.hidden = true;
        resolveConsentPromises(false);
      });
    }

    state.consentModal = { overlay, confirmBtn, declineBtn };
  }

  function openConsentModal() {
    createConsentModal();
    if (!state.consentModal) return;
    const { overlay, confirmBtn } = state.consentModal;
    if (confirmBtn) confirmBtn.disabled = false;
    overlay.hidden = false;
  }

  async function recordConsentForUser(userId) {
    if (!state.client || !userId) throw new Error('Missing user for consent');
    const existing = await getActiveConsent(userId);
    if (existing) {
      removePendingConsent(userId);
      return true;
    }
    const payload = {
      user_id: userId,
      consent_type: CONSENT_TYPE,
      version: CONSENT_VERSION,
    };
    const { error } = await state.client.from('consents').insert(payload);
    if (error) throw error;
    removePendingConsent(userId);
    return true;
  }

  function addPendingConsent(userId) {
    if (!userId) return;
    if (typeof localStorage === 'undefined') return;
    try {
      const ids = getPendingConsentIds();
      ids.add(userId);
      localStorage.setItem(PENDING_CONSENT_KEY, JSON.stringify(Array.from(ids)));
    } catch (error) {
      console.error('[Sporty] Failed to persist pending consent', error);
    }
  }

  function removePendingConsent(userId) {
    if (!userId) return;
    if (typeof localStorage === 'undefined') return;
    try {
      const ids = getPendingConsentIds();
      if (ids.delete(userId)) {
        localStorage.setItem(PENDING_CONSENT_KEY, JSON.stringify(Array.from(ids)));
      }
    } catch (error) {
      console.error('[Sporty] Failed to clear pending consent', error);
    }
  }

  function getPendingConsentIds() {
    if (typeof localStorage === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem(PENDING_CONSENT_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set(parsed);
      }
    } catch (error) {
      console.error('[Sporty] Unable to read pending consent data', error);
    }
    return new Set();
  }

  async function maybeApplyPendingConsent() {
    if (!state.client || !state.user) return false;
    const ids = getPendingConsentIds();
    if (!ids.has(state.user.id)) return false;
    try {
      const existing = await getActiveConsent(state.user.id);
      if (existing) {
        removePendingConsent(state.user.id);
        return true;
      }
      await recordConsentForUser(state.user.id);
      state.hasConsent = true;
      notifyListeners();
      resolveConsentPromises(true);
      return true;
    } catch (error) {
      console.error('[Sporty] Failed to apply pending consent', error);
      return false;
    }
  }

  function resolveConsentPromises(value) {
    if (!state.consentResolvers.length) return;
    state.consentResolvers.forEach((resolve) => {
      try {
        resolve(Boolean(value));
      } catch (error) {
        console.error('[Sporty] Consent promise error', error);
      }
    });
    state.consentResolvers = [];
  }

  async function fetchConsents() {
    if (!state.client || !state.user) return [];

    try {
      const { data, error } = await state.client
        .from('consents')
        .select('id, consent_type, version, granted_at, revoked_at')
        .eq('user_id', state.user.id)
        .order('granted_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[Sporty] Failed to fetch consents', error);
      return [];
    }
  }

  async function saveRecommendation(formPayload, resultPayload, extras = {}) {
    if (!state.client || !state.user || !state.hasConsent) {
      return { saved: false, reason: 'not-authorized' };
    }

    const pastSportsInput = Array.isArray(extras.pastSports) ? extras.pastSports : [];

    const isPremiumResult = extras && extras.analysisType === 'premium';

    try {
      await persistPastSports(pastSportsInput);
    } catch (error) {
      console.error('[Sporty] Failed to persist past sports', error);
    }

    const measurementRecord = {
      subject_type: 'adult',
      subject_user_id: state.user.id,
      measured_at: new Date().toISOString(),
      height_cm: formPayload.height_cm ?? null,
      weight_kg: formPayload.weight_kg ?? null,
      arm_span_cm: formPayload.arm_span_cm ?? null,
      leg_inseam_cm: formPayload.leg_inseam_cm ?? null,
      shoulder_width_cm: formPayload.shoulder_width_cm ?? null,
      hip_width_cm: formPayload.hip_width_cm ?? null,
      hand_length_cm: formPayload.hand_length_cm ?? null,
      foot_length_cm: formPayload.foot_length_cm ?? null,
    };

    const analysisInput = extras && extras.analysisInput ? extras.analysisInput : null;

    try {
      const measurementRes = await state.client
        .from('measurements')
        .insert([measurementRecord])
        .select('id')
        .single();

      if (measurementRes.error) throw measurementRes.error;

      const measurementId = measurementRes.data.id;

      if (analysisInput && hasAnalysisSelections(analysisInput)) {
        try {
          await persistAnalysisInput(measurementId, analysisInput, measurementRecord);
        } catch (error) {
          console.error('[Sporty] Failed to persist premium intake details', error);
        }
      }

      if (isPremiumResult) {
        return { saved: true, reason: 'premium-stored-server' };
      }

      const submissionRes = await state.client
        .from('submissions')
        .insert([
          {
            user_id: state.user.id,
            subject_type: 'self',
            payload: {
              form: formPayload,
              version: MODEL_VERSION,
            },
          },
        ])
        .select('id')
        .single();

      if (submissionRes.error) throw submissionRes.error;

      const summaryPayload = {
        suggested_sport: resultPayload.suggested_sport,
        reason: resultPayload.reason,
        matches: resultPayload.matches || [],
        total_considered: resultPayload.total_considered,
        analysis_type: extras.analysisType || 'free',
      };

      const recommendationRes = await state.client
        .from('recommendations')
        .insert([
          {
            user_id: state.user.id,
            submission_id: submissionRes.data.id,
            model_version: MODEL_VERSION,
            summary: JSON.stringify(summaryPayload),
          },
        ])
        .select('id')
        .single();

      if (recommendationRes.error) throw recommendationRes.error;

      const items = (resultPayload.matches || [])
        .map((match, index) => ({
          recommendation_id: recommendationRes.data.id,
          rank: index + 1,
          reason:
            (match.optimal_body &&
              match.optimal_body.spec &&
              match.optimal_body.spec.rationale) ||
            match.reason ||
            '',
        }))
        .filter((item) => item.reason);

      if (items.length) {
        const itemsRes = await state.client
          .from('recommendation_items')
          .insert(items);
        if (itemsRes.error) {
          console.warn('[Sporty] Unable to persist recommendation items', itemsRes.error);
        }
      }

      return { saved: true, recommendationId: recommendationRes.data.id };
    } catch (error) {
      console.error('[Sporty] Failed to save recommendation', error);
      return { saved: false, error };
    }
  }

  function hasAnalysisSelections(selection) {
    if (!selection) return false;
    const { preferences, goals, injuries } = selection;
    return (
      (Array.isArray(preferences) && preferences.length > 0) ||
      (Array.isArray(goals) && goals.length > 0) ||
      (Array.isArray(injuries) && injuries.length > 0)
    );
  }

  async function persistAnalysisInput(measurementId, selection, measurementRecord) {
    if (!state.client || !state.user || !measurementId) return null;

    const payload = {
      subject_type: measurementRecord.subject_type || 'adult',
      subject_user_id: measurementRecord.subject_user_id || state.user.id,
      subject_child_id: measurementRecord.subject_child_id || null,
      measurement_id: measurementId,
      notes: selection.notes ? sanitizeText(selection.notes, 280) : null,
    };

    const inputRes = await state.client
      .from('analysis_inputs')
      .insert([payload])
      .select('id')
      .single();

    if (inputRes.error) throw inputRes.error;

    const analysisInputId = inputRes.data.id;
    const operations = [];

    if (Array.isArray(selection.preferences) && selection.preferences.length) {
      const seen = new Set();
      const rows = selection.preferences.slice(0, 20).reduce((acc, item) => {
        const id = item && item.preference_id ? String(item.preference_id) : '';
        if (!id || seen.has(id)) return acc;
        seen.add(id);
        acc.push({
          analysis_input_id: analysisInputId,
          preference_id: id,
          priority: normalizePriority(item.priority),
        });
        return acc;
      }, []);
      if (rows.length) {
        operations.push(
          state.client.from('analysis_input_preferences').insert(rows)
        );
      }
    }

    if (Array.isArray(selection.goals) && selection.goals.length) {
      const seen = new Set();
      const rows = selection.goals.slice(0, 20).reduce((acc, item) => {
        const id = item && item.goal_id ? String(item.goal_id) : '';
        if (!id || seen.has(id)) return acc;
        seen.add(id);
        acc.push({
          analysis_input_id: analysisInputId,
          goal_id: id,
          priority: normalizePriority(item.priority),
        });
        return acc;
      }, []);
      if (rows.length) {
        operations.push(state.client.from('analysis_input_goals').insert(rows));
      }
    }

    if (Array.isArray(selection.injuries) && selection.injuries.length) {
      const seen = new Set();
      const rows = selection.injuries.slice(0, 20).reduce((acc, item) => {
        const injuryId = item && item.injury_id ? String(item.injury_id) : '';
        if (!injuryId) return acc;
        const subcategoryId = item && item.injury_subcategory_id ? String(item.injury_subcategory_id) : null;
        const uniqueKey = subcategoryId || injuryId;
        if (seen.has(uniqueKey)) return acc;
        seen.add(uniqueKey);
        acc.push({
          analysis_input_id: analysisInputId,
          injury_id: injuryId,
          injury_subcategory_id: subcategoryId,
          severity: normalizeSeverity(item.severity),
          notes: item && item.notes ? sanitizeText(item.notes, 280) : null,
        });
        return acc;
      }, []);
      if (rows.length) {
        operations.push(state.client.from('analysis_input_injuries').insert(rows));
      }
    }

    if (operations.length) {
      const results = await Promise.all(operations);
      results.forEach((res) => {
        if (res.error) {
          throw res.error;
        }
      });
    }

    return analysisInputId;
  }

  async function persistPastSports(entries) {
    if (!state.client || !state.user) return;
    const client = state.client;
    const userId = state.user.id;

    const normalized = Array.isArray(entries)
      ? entries
          .map((entry) => {
            const sportId = entry && entry.sport_subcategory_id ? String(entry.sport_subcategory_id).trim() : '';
            if (!sportId) return null;
            const record = {
              subject_type: 'adult',
              subject_user_id: userId,
              sport_subcategory_id: sportId,
            };

            const intensity = normalizeIntensity(entry ? entry.intensity : null);
            if (intensity) record.intensity = intensity;

            const years = normalizeDuration(entry ? entry.years_played : null);
            if (years !== null) record.years_played = years;

            const age = normalizeDuration(entry ? entry.age_started_years : null);
            if (age !== null) record.age_started_years = age;

            const liked = normalizeYesNoBoolean(entry ? entry.liked : null);
            if (liked !== null) record.liked = liked;

            const flair = normalizeYesNoBoolean(entry ? entry.had_flair : null);
            if (flair !== null) record.had_flair = flair;

            const skill = normalizeYesNoBoolean(entry ? entry.achieved_skill : null);
            if (skill !== null) record.achieved_skill = skill;

            return record;
          })
          .filter(Boolean)
      : [];

    await client
      .from('past_sports')
      .delete()
      .eq('subject_user_id', userId)
      .eq('subject_type', 'adult');

    if (!normalized.length) return;

    const { error } = await client
      .from('past_sports')
      .upsert(normalized, { onConflict: 'subject_user_id,sport_subcategory_id' });

    if (error) throw error;
  }

  function normalizeDuration(value) {
    if (value === null || typeof value === 'undefined' || value === '') return null;
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed)) return null;
    if (parsed < 0 || parsed > 80) return null;
    return Math.round(parsed * 10) / 10;
  }

  function normalizeIntensity(value) {
    if (!value) return null;
    const normalized = String(value).toLowerCase();
    return ['light', 'moderate', 'intense', 'elite'].includes(normalized) ? normalized : null;
  }

  function normalizeYesNoBoolean(value) {
    if (value === true) return true;
    if (value === false) return false;
    if (typeof value === 'string') {
      const normalized = value.toLowerCase();
      if (normalized === 'yes') return true;
      if (normalized === 'no') return false;
    }
    return null;
  }

  function normalizePriority(value) {
    return value === 'must_have' ? 'must_have' : 'nice_to_have';
  }

  function normalizeSeverity(value) {
    const allowed = new Set(['severe', 'somewhat_bad', 'mostly_healed']);
    return allowed.has(value) ? value : 'somewhat_bad';
  }

  function sanitizeText(value, maxLength) {
    if (!value) return null;
    const text = String(value).trim();
    if (!text) return null;
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength);
  }

  async function fetchRecommendations(limit = 20) {
    if (!state.client || !state.user) return [];

    try {
      const { data, error } = await state.client
        .from('recommendations')
        .select(
          'id, created_at, summary, submission:submissions(id, payload, created_at)'
        )
        .eq('user_id', state.user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((row) => {
        const summary = parseSummary(row.summary);
        return {
          id: row.id,
          created_at: row.created_at,
          summary,
          submission: row.submission || null,
        };
      });
    } catch (error) {
      console.error('[Sporty] Failed to fetch recommendations', error);
      return [];
    }
  }

  function parseSummary(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch (_error) {
      return {};
    }
  }

  async function getActiveConsent(userId) {
    if (!state.client || !userId) return null;
    const { data, error } = await state.client
      .from('consents')
      .select('id')
      .eq('user_id', userId)
      .eq('consent_type', CONSENT_TYPE)
      .is('revoked_at', null)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async function revokeConsent() {
    if (!state.client || !state.user) {
      throw new Error('Not signed in');
    }

    const consent = await getActiveConsent(state.user.id);
    if (!consent) {
      state.hasConsent = false;
      notifyListeners();
      resolveConsentPromises(false);
      return false;
    }

    const timestamp = new Date().toISOString();
    const { error } = await state.client
      .from('consents')
      .update({ revoked_at: timestamp })
      .eq('id', consent.id)
      .eq('user_id', state.user.id)
      .is('revoked_at', null);

    if (error) throw error;

    state.hasConsent = false;
    notifyListeners();
    resolveConsentPromises(false);
    return true;
  }
})();
