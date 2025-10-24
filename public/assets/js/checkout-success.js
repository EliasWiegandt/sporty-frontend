(function () {
  const root = document.querySelector('[data-checkout-success]');
  if (!root) return;

  const sportyApp = window.SportyApp;
  const statusEl = root.querySelector('[data-status]');
  const sessionEl = root.querySelector('[data-session-id]');
  const summary = root.querySelector('[data-credit-summary]');
  const adultEl = root.querySelector('[data-credit-adult]');
  const childEl = root.querySelector('[data-credit-child]');

  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id') || 'Unavailable';
  if (sessionEl) sessionEl.textContent = sessionId;

  function setStatus(message, tone) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.dataset.tone = tone || '';
  }

  function showSummary(adult, child) {
    if (adultEl) adultEl.textContent = String(adult);
    if (childEl) childEl.textContent = String(child);
    if (summary) summary.hidden = false;
  }

  async function loadCredits(userId) {
    if (!userId) {
      setStatus('Sign in to view your updated credits.', 'warn');
      return;
    }

    try {
      const resp = await fetch(`/api/credits?user_id=${encodeURIComponent(userId)}`, {
        headers: { Accept: 'application/json' },
      });
      if (!resp.ok) {
        throw new Error(`Failed to load credits (${resp.status})`);
      }
      const payload = await resp.json();
      const adult = normalize(payload.adult_credits);
      const child = normalize(payload.child_credits);
      sessionStorage.setItem(
        'sporty:lastCreditSnapshot',
        JSON.stringify({ adult, child })
      );
      showSummary(adult, child);
      setStatus('Credits updated. You’re ready to run your next analysis.', 'success');
    } catch (error) {
      console.error('[Sporty] Unable to refresh credits', error);
      setStatus('Payment succeeded, but we could not refresh credits automatically. Check your dashboard.', 'error');
    }
  }

  function normalize(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return 0;
    return Math.trunc(numeric);
  }

  async function init() {
    if (!sportyApp || !sportyApp.ready) {
      setStatus('Sign in to view your updated credits.', 'warn');
      return;
    }

    try {
      await sportyApp.ready;
    } catch (error) {
      console.error('[Sporty] Auth initialisation failed', error);
    }

    const user = sportyApp.getUser ? sportyApp.getUser() : null;
    if (!user) {
      setStatus('Sign in to view your updated credits.', 'warn');
      if (sportyApp.openAuth) sportyApp.openAuth();
      return;
    }

    await loadCredits(user.id);
  }

  init();
})();
