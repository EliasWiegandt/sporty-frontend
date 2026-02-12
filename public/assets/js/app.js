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
    purgeStatus: null,
    purgeRequestedAt: null,
    purgeCompletedAt: null,
    listeners: new Set(),
    consentResolvers: [],
    consentModal: null,
    authOverlay: null,
    authMode: 'signin',
    authStatusEl: null,
    readyResolve: null,
  };

  const tierState = {
    buttons: [],
    credits: { adult: null, child: null },
    userId: null,
    controller: null,
  };

  const ready = new Promise((resolve) => {
    state.readyResolve = resolve;
  });

  const api = {
    ready,
    getClient: () => state.client,
    getUser: () => state.user,
    getSession: () => state.session,
    hasConsent: () => state.hasConsent,
    onAuthChange: (callback) => {
      if (typeof callback !== 'function') return () => { };
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
    getConsentStatus: () => fetchConsentStatus(),
    grantConsent: () => grantConsent(),
    fetchConsents: () => fetchConsents(),
    revokeConsent: () => revokeConsent(),
    recordConsent: (userId) => recordConsentForUser(userId),
  };

  window.SportyApp = api;

  document.addEventListener('DOMContentLoaded', init);

  function hideConsentBanner() {
    const banner = document.querySelector('[data-consent-banner]');
    if (banner) {
      banner.hidden = true;
      banner.setAttribute('aria-hidden', 'true');
    }
  }

  function snapshot() {
    return {
      session: state.session,
      user: state.user,
      hasConsent: state.hasConsent,
      purgeStatus: state.purgeStatus,
      purgeRequestedAt: state.purgeRequestedAt,
      purgeCompletedAt: state.purgeCompletedAt,
    };
  }

  async function init() {
    setupAuthUI();
    setupTierCtas();
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
    // Bind to existing static modal elements
    const overlay = document.getElementById('auth-modal');
    state.authOverlay = overlay;

    if (!overlay) return;

    state.authStatusEl = document.getElementById('auth-status');
    const statusText = overlay.querySelector('[data-auth-status-text]');
    if (state.authStatusEl && statusText) {
      // Keep reference to text span for updates
      state.authStatusTextEl = statusText;
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

    // Bind triggers
    const loginButtons = document.querySelectorAll('[data-auth-open]');
    loginButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const mode = button.dataset.authMode === 'signup' ? 'signup' : 'signin';
        setAuthMode(mode, { preserveStatus: true });
        const resetRow = state.authOverlay?.querySelector('[data-auth-reset-row]');
        if (resetRow) resetRow.classList.add('hidden');
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

  function setupTierCtas() {
    tierState.buttons = Array.from(document.querySelectorAll('[data-tier-cta]'));
    if (!tierState.buttons.length) return;
    updateTierCtas(snapshot());
    api.onAuthChange((snap) => updateTierCtas(snap));
  }

  function updateTierCtas(snap) {
    if (!tierState.buttons.length) return;
    const user = snap && snap.user ? snap.user : null;

    if (!user) {
      tierState.userId = null;
      tierState.credits = { adult: null, child: null };
      tierState.buttons.forEach((btn) => {
        btn.disabled = false;
        btn.setAttribute('aria-disabled', 'false');
        btn.textContent = 'Sign up / log in and try';
        btn.onclick = (event) => {
          event.preventDefault();
          setAuthMode('signin', { preserveStatus: true });
          openAuthOverlay();
        };
      });
      return;
    }

    tierState.userId = user.id;
    tierState.buttons.forEach((btn) => {
      const kind = btn.dataset.tierKind === 'child' ? 'child' : 'adult';
      btn.disabled = false;
      btn.setAttribute('aria-disabled', 'false');
      btn.textContent = kind === 'child' ? 'Try Child Forecast and Analysis' : 'Try Premium Analysis';
      btn.onclick = (event) => {
        event.preventDefault();
        window.location.assign('/dashboard');
      };
    });
  }


  function setAuthMode(mode, { preserveStatus = false } = {}) {
    state.authMode = mode === 'signup' ? 'signup' : 'signin';
    const overlay = state.authOverlay;
    if (!overlay) return;

    const title = overlay.querySelector('[data-auth-title]');
    const submit = overlay.querySelector('[data-auth-submit]');
    const switchBtn = overlay.querySelector('[data-auth-switch]');
    const switchText = overlay.querySelector('[data-auth-switch-text]');
    const passwordInput = overlay.querySelector('input[name="password"]');
    const consentRow = overlay.querySelector('[data-signup-consent-row]');
    const consentInput = overlay.querySelector('[data-signup-consent]');
    const resetRow = overlay.querySelector('[data-auth-reset-row]');

    if (state.authMode === 'signin') {
      if (title) title.textContent = 'Log in';
      if (submit) submit.textContent = 'Log in';
      if (switchBtn) switchBtn.textContent = 'Sign up here';
      if (switchText) switchText.textContent = "Don't have an account yet?";
      if (passwordInput) passwordInput.setAttribute('autocomplete', 'current-password');
      if (consentRow) {
        consentRow.classList.add('hidden');
        if (consentInput) consentInput.checked = false;
      }
      if (resetRow) resetRow.classList.add('hidden');
    } else {
      if (title) title.textContent = 'Create account';
      if (submit) submit.textContent = 'Sign up';
      if (switchBtn) switchBtn.textContent = 'Log in here';
      if (switchText) switchText.textContent = 'Already have an account?';
      if (passwordInput) passwordInput.setAttribute('autocomplete', 'new-password');
      if (consentRow) consentRow.classList.remove('hidden');
      if (resetRow) resetRow.classList.add('hidden');
    }

    if (!preserveStatus) {
      updateAuthStatus();
    }
  }

  function openAuthOverlay() {
    if (!state.authOverlay) return;
    // Use Preline API if available
    if (window.HSOverlay) {
      window.HSOverlay.open(state.authOverlay);
    } else {
      state.authOverlay.classList.remove('hidden');
      state.authOverlay.classList.add('open'); // Fallback
    }

    const emailInput = state.authOverlay.querySelector('input[name="email"]');
    if (emailInput) {
      setTimeout(() => emailInput.focus(), 100);
    }
  }

  function closeAuthOverlay() {
    if (!state.authOverlay) return;
    if (window.HSOverlay) {
      window.HSOverlay.close(state.authOverlay);
    } else {
      state.authOverlay.classList.add('hidden');
      state.authOverlay.classList.remove('open');
    }

    const form = state.authOverlay.querySelector('[data-auth-form]');
    if (form) form.reset();
    setAuthMode('signin');
    updateAuthStatus();
  }

  function updateAuthStatus(message, variant = 'info') {
    if (!state.authStatusEl) return;

    if (!message) {
      state.authStatusEl.classList.add('hidden');
      if (state.authStatusTextEl) state.authStatusTextEl.textContent = '';
      state.authStatusEl.classList.remove('bg-red-50', 'border-red-200', 'text-red-800');
      state.authStatusEl.classList.add('bg-teal-50', 'border-teal-200', 'text-teal-800');
      return;
    }

    state.authStatusEl.classList.remove('hidden');
    if (state.authStatusTextEl) state.authStatusTextEl.textContent = message;

    if (variant === 'error') {
      state.authStatusEl.classList.remove('bg-teal-50', 'border-teal-200', 'text-teal-800');
      state.authStatusEl.classList.add('bg-red-50', 'border-red-200', 'text-red-800');
    } else {
      state.authStatusEl.classList.remove('bg-red-50', 'border-red-200', 'text-red-800');
      state.authStatusEl.classList.add('bg-teal-50', 'border-teal-200', 'text-teal-800');
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
        if (error) {
          if (isExistingAccountError(error)) {
            const loginResult = await tryLoginAfterSignup(email, password);
            if (loginResult === 'logged_in') {
              updateAuthStatus('Welcome back! You are logged in.', 'info');
              setTimeout(() => closeAuthOverlay(), 400);
              return;
            }
            updateAuthStatus(
              'This email is already registered. The password did not match. Use “Reset password” below.',
              'error'
            );
            showResetPasswordAction(email);
            return;
          }
          throw error;
        }
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

  function isExistingAccountError(error) {
    if (!error) return false;
    const message = String(error.message || '').toLowerCase();
    return message.includes('already') || message.includes('registered') || message.includes('exists');
  }

  async function tryLoginAfterSignup(email, password) {
    try {
      const { error } = await state.client.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return 'invalid';
      return 'logged_in';
    } catch (_) {
      return 'invalid';
    }
  }

  function showResetPasswordAction(email) {
    if (!state.authOverlay) return;
    const resetRow = state.authOverlay.querySelector('[data-auth-reset-row]');
    const resetBtn = state.authOverlay.querySelector('[data-auth-reset]');
    if (!resetRow || !resetBtn) return;
    resetRow.classList.remove('hidden');
    resetBtn.onclick = async (event) => {
      event.preventDefault();
      await handlePasswordReset(email);
    };
  }

  async function handlePasswordReset(email) {
    if (!state.client) return;
    try {
      const { error } = await state.client.auth.resetPasswordForEmail(email);
      if (error) throw error;
      updateAuthStatus('Password reset email sent. Check your inbox.', 'info');
    } catch (error) {
      updateAuthStatus(error.message || 'Failed to send reset email.', 'error');
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
      // Try local session cleanup even if the network sign-out call failed
      try {
        await state.client.auth.signOut({ scope: 'local' });
      } catch (e) {
        console.error('[Sporty] Local sign-out also failed', e);
      }
    }
    // Ensure UI/state resets even if supabase fails to emit an auth change
    updateSession(null);
    notifyListeners();
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
    if (!state.client || !state.user) {
      console.log('[Sporty] loadConsent: No client or user, skipping');
      return;
    }

    try {
      const status = await fetchConsentStatus();
      state.hasConsent = Boolean(status && status.has_consent);
      state.purgeStatus = status?.purge_status || null;
      state.purgeRequestedAt = status?.purge_requested_at || null;
      state.purgeCompletedAt = status?.purge_completed_at || null;
      if (!state.hasConsent) {
        const applied = await maybeApplyPendingConsent();
        if (applied) {
          const refreshed = await fetchConsentStatus();
          state.hasConsent = Boolean(refreshed && refreshed.has_consent);
          state.purgeStatus = refreshed?.purge_status || null;
          state.purgeRequestedAt = refreshed?.purge_requested_at || null;
          state.purgeCompletedAt = refreshed?.purge_completed_at || null;
        }
      }
      if (!state.hasConsent) {
        resolveConsentPromises(false);
      }
      notifyListeners();
    } catch (error) {
      console.error('[Sporty] Failed to load consent', error);
    }
  }

  async function authFetch(path, options = {}) {
    const token = state.session && state.session.access_token ? state.session.access_token : null;
    if (!token) {
      throw new Error('Missing auth token');
    }
    const headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    };
    return fetch(path, { ...options, headers });
  }

  async function fetchConsentStatus() {
    if (!state.user) return null;
    const response = await authFetch('/api/consent/status', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error('Unable to fetch consent status');
    }
    return response.json();
  }

  async function grantConsent() {
    if (!state.user) throw new Error('Not signed in');
    const response = await authFetch('/api/consent/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!response.ok) {
      throw new Error('Unable to grant consent');
    }
    const payload = await response.json();
    state.hasConsent = Boolean(payload && payload.has_consent);
    state.purgeStatus = payload?.purge_status || null;
    state.purgeRequestedAt = payload?.purge_requested_at || null;
    state.purgeCompletedAt = payload?.purge_completed_at || null;
    notifyListeners();
    return payload;
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
    if (!userId) throw new Error('Missing user for consent');
    await grantConsent();
    removePendingConsent(userId);
    return true;
  }

  function addPendingConsent(userId) {
    if (!userId) return;
    if (typeof localStorage === 'undefined') return;
    try {
      console.log('[Sporty] Adding pending consent for:', userId);
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
      console.log('[Sporty] Removing pending consent for:', userId);
      const ids = getPendingConsentIds();
      if (ids.delete(userId)) {
        localStorage.setItem(PENDING_CONSENT_KEY, JSON.stringify(Array.from(ids)));
        console.log('[Sporty] Pending consent removed successfully.');
      } else {
        console.log('[Sporty] No pending consent found to remove.');
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
    if (!state.user) return false;
    const ids = getPendingConsentIds();
    if (!ids.has(state.user.id)) return false;
    try {
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
      pelvic_bone_width_cm: formPayload.pelvic_bone_width_cm ?? null,
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

  async function revokeConsent() {
    if (!state.user) {
      throw new Error('Not signed in');
    }
    const response = await authFetch('/api/consent/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!response.ok) {
      throw new Error('Unable to revoke consent');
    }
    const payload = await response.json();
    state.hasConsent = Boolean(payload && payload.has_consent);
    state.purgeStatus = payload?.purge_status || 'pending';
    state.purgeRequestedAt = payload?.purge_requested_at || null;
    state.purgeCompletedAt = payload?.purge_completed_at || null;
    removePendingConsent(state.user.id);
    notifyListeners();
    resolveConsentPromises(false);
    return true;
  }
})();
