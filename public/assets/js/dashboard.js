(function () {
  const sportyApp = window.SportyApp;
  const root = document.querySelector('[data-dashboard-root]');
  if (!root || !sportyApp) return;

  const signedOutBlock = root.querySelector('[data-dashboard-signed-out]');
  const signedInBlock = root.querySelector('[data-dashboard-signed-in]');
  const creditsAdultEl = root.querySelector('[data-credits-adult]');
  const creditsChildEl = root.querySelector('[data-credits-child]');
  const lockerList = root.querySelector('[data-measurement-locker]');
  const lockerEmpty = root.querySelector('[data-measurement-locker-empty]');
  let creditsController = null;

  const historyGrid = root.querySelector('[data-history-grid]');

  // Account elements
  const emailEl = root.querySelector('[data-profile-email]');
  const consentStatusEl = root.querySelector('[data-profile-consent-status]');
  const consentToggle = root.querySelector('[data-consent-toggle]');
  const toggleHelp = root.querySelector('[data-profile-toggle-help]');
  const signoutBtn = root.querySelector('[data-auth-signout]');

  function readCreditSnapshot() {
    try {
      const raw = sessionStorage.getItem('sporty:lastCreditSnapshot');
      if (!raw) return null;
      sessionStorage.removeItem('sporty:lastCreditSnapshot');
      const parsed = JSON.parse(raw);
      return {
        adult: Number(parsed.adult) || 0,
        child: Number(parsed.child) || 0,
      };
    } catch (error) {
      console.warn('[Sporty] Failed to read credit snapshot', error);
      return null;
    }
  }

  sportyApp.ready.then(() => {
    if (typeof sportyApp.onAuthChange === 'function') {
      sportyApp.onAuthChange(handleSnapshot);
    }
  });

  if (consentToggle) {
    consentToggle.addEventListener('change', handleToggleChange);
  }

  if (signoutBtn) {
    signoutBtn.addEventListener('click', () => {
      if (sportyApp && typeof sportyApp.signOut === 'function') {
        sportyApp.signOut();
      }
    });
  }

  function handleSnapshot(snapshot) {
    const signedIn = Boolean(snapshot && snapshot.user);
    if (signedOutBlock) signedOutBlock.hidden = signedIn;
    if (signedInBlock) signedInBlock.hidden = !signedIn;
    if (consentToggle) consentToggle.disabled = !signedIn;

    if (!signedIn) {
      if (creditsController) {
        creditsController.abort();
        creditsController = null;
      }
      setCredits('-', '-');
      clearLocker();
      clearHistory();

      if (emailEl) emailEl.textContent = '';
      if (consentStatusEl) consentStatusEl.textContent = '';
      if (consentToggle) consentToggle.checked = false;
      if (toggleHelp) toggleHelp.textContent = '';
      return;
    }

    // Account updates
    if (emailEl) {
      emailEl.textContent = snapshot.user.email || '';
    }
    updateConsentStatus(snapshot.hasConsent);
    // Only update toggle if the state actually changed to prevent flicker
    if (consentToggle && consentToggle.checked !== Boolean(snapshot.hasConsent)) {
      consentToggle.checked = Boolean(snapshot.hasConsent);
    }
    updateToggleHelp(snapshot.hasConsent);

    setCredits('...', '...');
    const creditSnapshot = readCreditSnapshot();
    if (creditSnapshot) {
      setCredits(String(creditSnapshot.adult), String(creditSnapshot.child));
    }
    loadCredits(snapshot.user.id);
    loadHistory(snapshot.user.id);
    renderLocker([]);
  }

  function updateToggleHelp(hasConsent) {
    if (!toggleHelp) return;
    toggleHelp.textContent = hasConsent
      ? 'Sporty will remember new free matches. Turn this off to stop storing data.'
      : 'Turn this on to let Sporty remember your future free matches.';
  }

  function updateConsentStatus(hasConsent) {
    if (!consentStatusEl) return;
    if (hasConsent) {
      consentStatusEl.className = 'text-sm text-teal-700 bg-teal-50 px-3 py-2 rounded-md border border-teal-100';
      consentStatusEl.textContent = 'You have granted Sporty data-retention consent.';
    } else {
      consentStatusEl.className = 'text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-md border border-amber-100';
      consentStatusEl.textContent = 'You have not granted data-retention consent.';
    }
  }

  async function handleToggleChange(event) {
    const target = event.currentTarget;
    if (!target) return;

    if (target.checked) {
      // Grant consent directly without modal
      if (!sportyApp.getClient() || !sportyApp.getUser()) {
        target.checked = false;
        return;
      }

      target.disabled = true;
      try {
        const client = sportyApp.getClient();
        const user = sportyApp.getUser();

        // Check if consent already exists
        const { data: existing } = await client
          .from('consents')
          .select('id')
          .eq('user_id', user.id)
          .eq('consent_type', 'data_retention')
          .is('revoked_at', null)
          .maybeSingle();

        if (!existing) {
          // Record consent using app API to ensure pending flags are cleared
          if (typeof sportyApp.recordConsent === 'function') {
            await sportyApp.recordConsent(user.id);
          } else {
            // Fallback for older app.js versions (shouldn't happen if reloaded)
            const payload = {
              user_id: user.id,
              consent_type: 'data_retention',
              version: 'adult-data-retention-v1',
            };
            const { error } = await client.from('consents').insert(payload);
            if (error) throw error;
          }
        }

        // Refresh consent state
        await sportyApp.refreshConsent();

        updateToggleHelp(true);
        updateConsentStatus(true);
      } catch (error) {
        console.error('[Dashboard] Failed to grant consent', error);
        target.checked = false;
        if (toggleHelp) {
          toggleHelp.textContent = 'Unable to grant consent. Please try again.';
        }
      } finally {
        target.disabled = false;
      }
    } else {
      if (typeof sportyApp.revokeConsent !== 'function') return;
      target.disabled = true;
      try {
        await sportyApp.revokeConsent();
        updateToggleHelp(false);
        updateConsentStatus(false);
      } catch (error) {
        console.error(error);
        target.checked = true; // Revert toggle if revoke fails
      } finally {
        target.disabled = false;
      }
    }
  }

  function setCredits(adult, child) {
    if (creditsAdultEl) creditsAdultEl.textContent = adult;
    if (creditsChildEl) creditsChildEl.textContent = child;
  }

  function normalizeCreditCount(value) {
    if (value === null || value === undefined) return 0;
    const numeric = Number(value);
    if (Number.isNaN(numeric) || !Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.trunc(numeric));
  }

  async function loadCredits(userId) {
    if (!userId) {
      setCredits('-', '-');
      return;
    }

    if (creditsController) {
      creditsController.abort();
    }

    creditsController = new AbortController();

    try {
      const resp = await fetch(`/api/credits?user_id=${encodeURIComponent(userId)}`, {
        headers: { Accept: 'application/json' },
        signal: creditsController.signal,
      });

      if (!resp.ok) {
        throw new Error(`Failed to load credits: ${resp.status}`);
      }

      const payload = await resp.json();
      const adult = normalizeCreditCount(payload.adult_credits);
      const child = normalizeCreditCount(payload.child_credits);
      setCredits(String(adult), String(child));
      creditsController = null;
    } catch (error) {
      if (creditsController && creditsController.signal.aborted) {
        creditsController = null;
        return;
      }
      console.error('[Sporty] Failed to load credits', error);
      setCredits('--', '--');
      creditsController = null;
    }
  }

  function clearLocker() {
    renderLocker(null);
  }

  function renderLocker(entries) {
    if (!lockerList || !lockerEmpty) return;
    lockerList.innerHTML = '';
    if (!entries || !entries.length) {
      lockerEmpty.hidden = false;
      lockerList.hidden = true;
      return;
    }

    lockerEmpty.hidden = true;
    lockerList.hidden = false;
    entries.forEach((entry) => {
      const li = document.createElement('li');
      li.textContent = entry.label || 'Saved measurements';
      lockerList.appendChild(li);
    });
  }

  function clearHistory() {
    if (historyGrid) historyGrid.innerHTML = '';
  }

  async function loadHistory(userId) {
    if (!historyGrid) return;

    // Clear placeholders
    historyGrid.innerHTML = '<p class="col-span-full text-center py-8 text-slate-500">Loading history...</p>';

    const client = sportyApp?.getClient ? sportyApp.getClient() : null;
    if (!client) return;

    try {
      // Fetch adult results
      const { data: adultData, error: adultError } = await client
        .from('recommendation_results')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (adultError) throw adultError;

      // TODO: Fetch child results if table exists (e.g. child_forecast_runs)
      // For now, we'll just show adult results

      const items = (adultData || []).map(item => ({
        id: item.id,
        title: item.is_premium ? 'Adult Premium Analysis' : 'Adult Free Analysis',
        date: item.created_at,
        summary: item.summary || 'Analysis completed.',
        isPremium: item.is_premium,
        link: item.is_premium ? `/results/premium?id=${item.id}` : `/results?id=${item.id}` // Assuming ID-based routing works or will work
      }));

      renderHistory(items);

    } catch (error) {
      console.error('[Sporty] Failed to load history', error);
      historyGrid.innerHTML = '<p class="col-span-full text-center py-8 text-red-500">Unable to load history.</p>';
    }
  }

  function renderHistory(items) {
    if (!historyGrid) return;
    historyGrid.innerHTML = '';

    if (!items || items.length === 0) {
      historyGrid.innerHTML = '<p class="col-span-full text-center py-8 text-slate-500">No analyses found. Start a new one!</p>';
      return;
    }

    items.forEach(item => {
      const article = document.createElement('article');
      article.className = 'history-card';

      const dateStr = new Date(item.date).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      const badgeClass = item.isPremium ? 'badge-premium' : 'badge-free';
      const badgeText = item.isPremium ? 'Premium' : 'Free';

      article.innerHTML = `
        <div class="history-card__header">
          <div>
            <h2>${item.title}</h2>
            <p class="history-card__meta">${dateStr}</p>
          </div>
          <span class="${badgeClass}">${badgeText}</span>
        </div>
        <p class="history-card__summary">${item.summary}</p>
        <div class="history-card__actions">
          <a class="btn-pill btn-pill-primary btn-pill-sm" href="${item.link}">View details</a>
        </div>
      `;
      historyGrid.appendChild(article);
    });
  }
})();
